
-- routes
DROP POLICY IF EXISTS "Non-drivers can delete routes" ON public.routes;
CREATE POLICY "Only admins can delete routes"
  ON public.routes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- route_clients
DROP POLICY IF EXISTS "Non-drivers can delete route_clients" ON public.route_clients;
CREATE POLICY "Only admins can delete route_clients"
  ON public.route_clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- route_client_items
DROP POLICY IF EXISTS "Non-drivers can delete route_client_items" ON public.route_client_items;
CREATE POLICY "Only admins can delete route_client_items"
  ON public.route_client_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
