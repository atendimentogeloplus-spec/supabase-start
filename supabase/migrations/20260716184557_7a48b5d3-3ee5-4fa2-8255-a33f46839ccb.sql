CREATE TABLE public.fin_receivable_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receivable_id UUID NOT NULL REFERENCES public.fin_receivables(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (receivable_id, sale_id)
);

CREATE INDEX idx_fin_receivable_sales_receivable ON public.fin_receivable_sales(receivable_id);
CREATE INDEX idx_fin_receivable_sales_sale ON public.fin_receivable_sales(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_receivable_sales TO authenticated;
GRANT ALL ON public.fin_receivable_sales TO service_role;

ALTER TABLE public.fin_receivable_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read links"
  ON public.fin_receivable_sales FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert links"
  ON public.fin_receivable_sales FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete links"
  ON public.fin_receivable_sales FOR DELETE
  TO authenticated USING (true);