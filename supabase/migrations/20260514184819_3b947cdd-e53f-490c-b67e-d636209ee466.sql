CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  region TEXT,
  order_projection TEXT,
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'contato',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-drivers can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Non-drivers can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (NOT has_role(auth.uid(), 'driver'::app_role))
  WITH CHECK (NOT has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Non-drivers can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (NOT has_role(auth.uid(), 'driver'::app_role));

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_status ON public.leads(status);