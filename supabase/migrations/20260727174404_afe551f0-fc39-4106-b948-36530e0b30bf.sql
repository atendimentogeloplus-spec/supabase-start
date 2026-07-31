
CREATE TABLE public.week_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day TEXT NOT NULL CHECK (day IN ('mon','tue','wed','thu','fri','sat','avulsos')),
  client_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_plan_items TO authenticated;
GRANT ALL ON public.week_plan_items TO service_role;
ALTER TABLE public.week_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view week plan" ON public.week_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert week plan" ON public.week_plan_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update week plan" ON public.week_plan_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin can delete week plan" ON public.week_plan_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_week_plan_day_pos ON public.week_plan_items(day, position);
CREATE TRIGGER update_week_plan_items_updated_at BEFORE UPDATE ON public.week_plan_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
