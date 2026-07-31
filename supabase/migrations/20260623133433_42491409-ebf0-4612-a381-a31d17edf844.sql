
CREATE TABLE public.fin_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  client_name TEXT,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_receivables TO authenticated;
GRANT ALL ON public.fin_receivables TO service_role;

ALTER TABLE public.fin_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own receivables" ON public.fin_receivables
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_fin_receivables_updated_at
  BEFORE UPDATE ON public.fin_receivables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
