CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  notes text,
  owner_id uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (is_admin() OR owner_id = auth.uid());
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (is_admin() OR owner_id = auth.uid());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (is_admin() OR owner_id = auth.uid()) WITH CHECK (is_admin() OR owner_id = auth.uid());
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated USING (is_admin());
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();