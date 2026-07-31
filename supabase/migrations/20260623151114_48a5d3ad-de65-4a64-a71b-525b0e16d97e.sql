
CREATE TABLE public.fin_payables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  supplier_name TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  category TEXT,
  payment_method TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_payables TO authenticated;
GRANT ALL ON public.fin_payables TO service_role;

ALTER TABLE public.fin_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payables"
  ON public.fin_payables FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_fin_payables_updated_at
  BEFORE UPDATE ON public.fin_payables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
