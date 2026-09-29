ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('a_enviar','enviado','em_producao','entregue'));
ALTER TABLE public.purchase_orders ALTER COLUMN status SET DEFAULT 'a_enviar';

CREATE TABLE public.stock_minimums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  modality text NOT NULL CHECK (modality IN ('lisos','guarda')),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  min_qty numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stock_minimums_key ON public.stock_minimums (product_id, modality, coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_minimums TO authenticated;
GRANT ALL ON public.stock_minimums TO service_role;
ALTER TABLE public.stock_minimums ENABLE ROW LEVEL SECURITY;
CREATE POLICY smin_admin ON public.stock_minimums FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());