CREATE OR REPLACE FUNCTION public.is_stockist() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.has_role(auth.uid(), 'stockist') AND public.is_active_user() $$;
CREATE POLICY stock_view_products ON public.products FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_po ON public.purchase_orders FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_poi ON public.purchase_order_items FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_sm ON public.stock_movements FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_smin ON public.stock_minimums FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_cf ON public.client_forecasts FOR SELECT TO authenticated USING (public.is_stockist());
CREATE POLICY stock_view_clients ON public.clients FOR SELECT TO authenticated USING (public.is_stockist());