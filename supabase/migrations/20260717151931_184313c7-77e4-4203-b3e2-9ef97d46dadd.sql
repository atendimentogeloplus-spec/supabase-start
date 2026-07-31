
CREATE TABLE public.fin_patrimony_maintenances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_code TEXT NOT NULL,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  responsible TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_maintenances TO authenticated;
GRANT ALL ON public.fin_patrimony_maintenances TO service_role;

ALTER TABLE public.fin_patrimony_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patrimony maintenances"
ON public.fin_patrimony_maintenances
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fin_patrimony_maintenances_user_code
  ON public.fin_patrimony_maintenances(user_id, item_code);

CREATE TRIGGER trg_fin_patrimony_maintenances_updated_at
  BEFORE UPDATE ON public.fin_patrimony_maintenances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Um código único por item dentro do mesmo ano (ignora vazios)
CREATE UNIQUE INDEX idx_fin_patrimony_items_user_code_year_unique
  ON public.fin_patrimony_items(user_id, code, year)
  WHERE code IS NOT NULL AND code <> '';
