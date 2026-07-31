CREATE TABLE public.fin_closing_manual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  closing_group TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month, closing_group)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_closing_manual TO authenticated;
GRANT ALL ON public.fin_closing_manual TO service_role;
ALTER TABLE public.fin_closing_manual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.fin_closing_manual FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_closing_manual_updated BEFORE UPDATE ON public.fin_closing_manual FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();