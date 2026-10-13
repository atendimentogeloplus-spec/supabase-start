CREATE OR REPLACE FUNCTION public.can_view_stock() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_active_user() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('stockist','rep_internal','rep_external','rep_level2'))
$$;
CREATE OR REPLACE FUNCTION public.can_edit_stock() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin() OR (public.is_active_user() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('rep_internal','rep_external','rep_level2')))
$$;
CREATE POLICY rep_po_ins ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_po_upd ON public.purchase_orders FOR UPDATE TO authenticated USING (public.can_edit_stock()) WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_poi_all ON public.purchase_order_items FOR ALL TO authenticated USING (public.can_edit_stock()) WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_products_ins ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_products_upd ON public.products FOR UPDATE TO authenticated USING (public.can_edit_stock()) WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_cf_all ON public.client_forecasts FOR ALL TO authenticated USING (public.can_edit_stock()) WITH CHECK (public.can_edit_stock());
CREATE POLICY rep_suppliers_ins ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.can_edit_stock());
CREATE OR REPLACE FUNCTION public.confirm_order_stock(_order_id uuid, _modality text, _client_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE o public.purchase_orders;
BEGIN
  IF NOT public.can_edit_stock() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.status <> 'entregue' THEN RAISE EXCEPTION 'Pedido ainda não foi entregue'; END IF;
  IF o.stock_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'Entrada já confirmada'; END IF;
  IF _modality NOT IN ('lisos','guarda') THEN RAISE EXCEPTION 'Modalidade inválida'; END IF;
  IF _modality = 'guarda' AND _client_id IS NULL THEN RAISE EXCEPTION 'Selecione o cliente'; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, order_id, note)
  SELECT product_id, 'entrada', _modality, CASE WHEN _modality='guarda' THEN _client_id END, quantity, o.id, 'Pedido ' || o.number
  FROM public.purchase_order_items WHERE order_id = o.id;
  UPDATE public.purchase_orders SET stock_confirmed_at = now(), stock_modality = _modality,
    client_id = COALESCE(CASE WHEN _modality='guarda' THEN _client_id END, client_id) WHERE id = o.id;
END $function$;