CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'un',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_admin ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  supplier text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','em_producao','entregue')),
  stock_confirmed_at timestamptz,
  stock_modality text CHECK (stock_modality IN ('lisos','guarda')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_admin ON public.purchase_orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL CHECK (quantity > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY poi_admin ON public.purchase_order_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  kind text NOT NULL CHECK (kind IN ('entrada','saida')),
  modality text NOT NULL CHECK (modality IN ('lisos','guarda')),
  client_id uuid REFERENCES public.clients(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (modality <> 'guarda' OR client_id IS NOT NULL)
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY sm_select ON public.stock_movements FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY sm_insert ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE TABLE public.client_forecasts (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto','manual')),
  manual_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_forecasts TO authenticated;
GRANT ALL ON public.client_forecasts TO service_role;
ALTER TABLE public.client_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cf_admin ON public.client_forecasts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER cf_updated BEFORE UPDATE ON public.client_forecasts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Confirmação manual de entrada de pedido entregue
CREATE OR REPLACE FUNCTION public.confirm_order_stock(_order_id uuid, _modality text, _client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.purchase_orders;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
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
END $$;

-- Saída com checagem de saldo
CREATE OR REPLACE FUNCTION public.register_stock_exit(_product_id uuid, _modality text, _client_id uuid, _quantity numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _modality = 'guarda' AND _client_id IS NULL THEN RAISE EXCEPTION 'Selecione o cliente'; END IF;
  SELECT COALESCE(SUM(CASE WHEN kind='entrada' THEN quantity ELSE -quantity END),0) INTO bal
  FROM public.stock_movements
  WHERE product_id = _product_id AND modality = _modality
    AND (_modality = 'lisos' OR client_id = _client_id);
  IF bal < _quantity THEN RAISE EXCEPTION 'Saldo insuficiente (disponível: %)', bal; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, note)
  VALUES (_product_id, 'saida', _modality, CASE WHEN _modality='guarda' THEN _client_id END, _quantity, _note);
END $$;

REVOKE EXECUTE ON FUNCTION public.confirm_order_stock(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_stock_exit(uuid, text, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_stock(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_stock_exit(uuid, text, uuid, numeric, text) TO authenticated;