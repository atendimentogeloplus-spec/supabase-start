CREATE OR REPLACE FUNCTION public.can_view_stock() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('stockist','rep_internal','rep_external'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_stock() TO authenticated;
CREATE POLICY rep_view_products ON public.products FOR SELECT TO authenticated USING (public.can_view_stock());
CREATE POLICY rep_view_po ON public.purchase_orders FOR SELECT TO authenticated USING (public.can_view_stock());
CREATE POLICY rep_view_poi ON public.purchase_order_items FOR SELECT TO authenticated USING (public.can_view_stock());
CREATE POLICY rep_view_sm ON public.stock_movements FOR SELECT TO authenticated USING (public.can_view_stock());
CREATE POLICY rep_view_smin ON public.stock_minimums FOR SELECT TO authenticated USING (public.can_view_stock());
CREATE POLICY rep_view_cf ON public.client_forecasts FOR SELECT TO authenticated USING (public.can_view_stock());