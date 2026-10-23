ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS delivered_qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS last_received_at timestamptz;
UPDATE public.purchase_order_items i SET delivered_qty = i.quantity FROM public.purchase_orders o WHERE o.id = i.order_id AND o.stock_confirmed_at IS NOT NULL;
UPDATE public.purchase_orders SET last_received_at = stock_confirmed_at WHERE stock_confirmed_at IS NOT NULL;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status = ANY (ARRAY['a_enviar','enviado','em_producao','parcial','entregue']));

CREATE OR REPLACE FUNCTION public.receive_order_stock(_order_id uuid, _modality text, _client_id uuid, _items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.purchase_orders; r record; it public.purchase_order_items; mod text; cli uuid; pending numeric;
BEGIN
  IF NOT public.can_edit_stock() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.stock_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'Pedido já foi totalmente entregue'; END IF;
  mod := COALESCE(o.stock_modality, _modality);
  IF mod NOT IN ('lisos','guarda') THEN RAISE EXCEPTION 'Modalidade inválida'; END IF;
  cli := CASE WHEN mod='guarda' THEN COALESCE(CASE WHEN o.stock_modality IS NOT NULL THEN o.client_id END, _client_id) END;
  IF mod = 'guarda' AND cli IS NULL THEN RAISE EXCEPTION 'Selecione o cliente'; END IF;
  FOR r IN SELECT (e->>'item_id')::uuid AS item_id, (e->>'qty')::numeric AS qty FROM jsonb_array_elements(_items) e LOOP
    IF r.qty IS NULL OR r.qty <= 0 THEN CONTINUE; END IF;
    SELECT * INTO it FROM public.purchase_order_items WHERE id = r.item_id AND order_id = o.id FOR UPDATE;
    IF it.id IS NULL THEN RAISE EXCEPTION 'Item inválido'; END IF;
    IF it.delivered_qty + r.qty > it.quantity THEN RAISE EXCEPTION 'Quantidade maior que o pendente do pedido'; END IF;
    INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, order_id, note, created_by)
    VALUES (it.product_id, 'entrada', mod, cli, r.qty, o.id, 'Pedido ' || o.number, auth.uid());
    UPDATE public.purchase_order_items SET delivered_qty = delivered_qty + r.qty WHERE id = it.id;
  END LOOP;
  SELECT COALESCE(SUM(quantity - delivered_qty),0) INTO pending FROM public.purchase_order_items WHERE order_id = o.id;
  UPDATE public.purchase_orders SET stock_modality = mod, last_received_at = now(),
    client_id = COALESCE(cli, client_id),
    status = CASE WHEN pending <= 0 THEN 'entregue' ELSE 'parcial' END,
    stock_confirmed_at = CASE WHEN pending <= 0 THEN now() END
  WHERE id = o.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.receive_order_stock(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_order_stock(uuid, text, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_order_stock(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.purchase_orders;
BEGIN
  IF NOT public.can_edit_stock() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO o FROM public.purchase_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.last_received_at IS NULL OR o.stock_modality IS NULL THEN RAISE EXCEPTION 'Este pedido não teve entrada no estoque'; END IF;
  IF o.last_received_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'Prazo de 48h para desfazer já passou'; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, order_id, note, created_by)
  SELECT product_id, 'saida', o.stock_modality, CASE WHEN o.stock_modality='guarda' THEN o.client_id END, delivered_qty, o.id,
         'Entrega desfeita - Pedido ' || o.number, auth.uid()
  FROM public.purchase_order_items WHERE order_id = o.id AND delivered_qty > 0;
  UPDATE public.purchase_order_items SET delivered_qty = 0 WHERE order_id = o.id;
  UPDATE public.purchase_orders SET stock_confirmed_at = NULL, stock_modality = NULL, last_received_at = NULL, status = 'enviado' WHERE id = o.id;
END $$;