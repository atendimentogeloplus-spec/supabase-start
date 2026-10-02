CREATE TABLE public.suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_admin ON public.suppliers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY suppliers_view ON public.suppliers FOR SELECT TO authenticated USING (public.can_view_stock());
INSERT INTO public.suppliers (name) SELECT DISTINCT trim(supplier) FROM public.purchase_orders WHERE supplier IS NOT NULL AND trim(supplier) <> '' ON CONFLICT DO NOTHING;