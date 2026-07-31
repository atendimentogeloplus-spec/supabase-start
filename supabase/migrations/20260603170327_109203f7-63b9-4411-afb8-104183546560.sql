
CREATE TABLE public.user_tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tab)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tab_permissions TO authenticated;
GRANT ALL ON public.user_tab_permissions TO service_role;

ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tab permissions"
  ON public.user_tab_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tab permissions"
  ON public.user_tab_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed driver atual com Rotas + Freezers
INSERT INTO public.user_tab_permissions (user_id, tab)
SELECT u.id, t.tab
FROM auth.users u
CROSS JOIN (VALUES ('routes'), ('freezers')) AS t(tab)
WHERE u.email = 'renato_carsalade@hotmail.com'
ON CONFLICT DO NOTHING;
