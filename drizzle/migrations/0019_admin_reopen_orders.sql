CREATE OR REPLACE FUNCTION public.undo_order_stock(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.purchase_orders;
BEGIN
  IF NOT public.can_edit_stock() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.last_received_at IS NULL OR o.stock_modality IS NULL THEN RAISE EXCEPTION 'Este pedido não teve entrada no estoque'; END IF;
  IF NOT public.is_admin() AND o.last_received_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'Prazo de 48h para desfazer já passou'; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, order_id, note, created_by)
  SELECT product_id, 'saida', o.stock_modality, CASE WHEN o.stock_modality='guarda' THEN o.client_id END, delivered_qty, o.id,
         'Entrega desfeita - Pedido ' || o.number, auth.uid()
  FROM public.purchase_order_items WHERE order_id = o.id AND delivered_qty > 0;
  UPDATE public.purchase_order_items SET delivered_qty = 0 WHERE order_id = o.id;
  UPDATE public.purchase_orders SET stock_confirmed_at = NULL, stock_modality = NULL, last_received_at = NULL, status = 'enviado' WHERE id = o.id;
END $$;