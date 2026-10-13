CREATE OR REPLACE FUNCTION public.can_edit_stock() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin() OR (public.is_active_user() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('rep_internal','rep_external','rep_level2','stockist')))
$$;
CREATE POLICY stockist_sm_ins ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_stockist() AND public.is_active_user());
DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.register_stock_exit'::regproc);
  d := replace(d, 'IF NOT public.is_admin() THEN', 'IF NOT (public.is_admin() OR (public.is_stockist() AND public.is_active_user())) THEN');
  EXECUTE d;
END $$;