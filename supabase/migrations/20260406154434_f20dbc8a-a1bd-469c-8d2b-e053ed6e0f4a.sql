
-- Price tables (e.g. Varejo, Atacado, etc.)
CREATE TABLE public.price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view price_tables" ON public.price_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert price_tables" ON public.price_tables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update price_tables" ON public.price_tables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete price_tables" ON public.price_tables FOR DELETE TO authenticated USING (true);

-- Product prices linking product + table
CREATE TABLE public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_table_id uuid NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, price_table_id)
);

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view product_prices" ON public.product_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert product_prices" ON public.product_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update product_prices" ON public.product_prices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete product_prices" ON public.product_prices FOR DELETE TO authenticated USING (true);

-- Add price_table_name to sale_items so the receipt shows which table was used
ALTER TABLE public.sale_items ADD COLUMN price_table_name text;

-- Trigger for updated_at on price_tables
CREATE TRIGGER update_price_tables_updated_at
  BEFORE UPDATE ON public.price_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
