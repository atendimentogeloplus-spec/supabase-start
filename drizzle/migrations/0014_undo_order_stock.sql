CREATE OR REPLACE FUNCTION public.undo_order_stock(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.purchase_orders;
BEGIN
  IF NOT public.can_edit_stock() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.stock_confirmed_at IS NULL THEN RAISE EXCEPTION 'Este pedido não teve entrada no estoque'; END IF;
  IF o.stock_confirmed_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'Prazo de 48h para desfazer já passou'; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, order_id, note, created_by)
  SELECT product_id, 'saida', o.stock_modality, CASE WHEN o.stock_modality='guarda' THEN o.client_id END, quantity, o.id,
         'Entrega desfeita - Pedido ' || o.number, auth.uid()
  FROM public.purchase_order_items WHERE order_id = o.id;
  UPDATE public.purchase_orders SET stock_confirmed_at = NULL, stock_modality = NULL, status = 'enviado' WHERE id = o.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.undo_order_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_order_stock(uuid) TO authenticated;