-- Block write operations for users with 'driver' role on all data tables.
-- Drivers retain SELECT (existing "Authenticated users can view ..." policies remain unchanged).

-- Helper: replace existing INSERT/UPDATE/DELETE policies that allowed any authenticated user
-- with policies that additionally exclude users with the 'driver' role.

-- clients
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
CREATE POLICY "Non-drivers can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update clients" ON public.clients FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete clients" ON public.clients FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- products
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
CREATE POLICY "Non-drivers can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update products" ON public.products FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete products" ON public.products FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- price_tables
DROP POLICY IF EXISTS "Auth users can insert price_tables" ON public.price_tables;
DROP POLICY IF EXISTS "Auth users can update price_tables" ON public.price_tables;
DROP POLICY IF EXISTS "Auth users can delete price_tables" ON public.price_tables;
CREATE POLICY "Non-drivers can insert price_tables" ON public.price_tables FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update price_tables" ON public.price_tables FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete price_tables" ON public.price_tables FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- drivers
DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can delete drivers" ON public.drivers;
CREATE POLICY "Non-drivers can insert drivers" ON public.drivers FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update drivers" ON public.drivers FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete drivers" ON public.drivers FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- routes
DROP POLICY IF EXISTS "Authenticated users can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Authenticated users can update routes" ON public.routes;
DROP POLICY IF EXISTS "Authenticated users can delete routes" ON public.routes;
CREATE POLICY "Non-drivers can insert routes" ON public.routes FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update routes" ON public.routes FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete routes" ON public.routes FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- route_clients
DROP POLICY IF EXISTS "Authenticated users can insert route_clients" ON public.route_clients;
DROP POLICY IF EXISTS "Authenticated users can update route_clients" ON public.route_clients;
DROP POLICY IF EXISTS "Authenticated users can delete route_clients" ON public.route_clients;
CREATE POLICY "Non-drivers can insert route_clients" ON public.route_clients FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update route_clients" ON public.route_clients FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete route_clients" ON public.route_clients FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- route_client_items
DROP POLICY IF EXISTS "Authenticated users can insert route_client_items" ON public.route_client_items;
DROP POLICY IF EXISTS "Authenticated users can update route_client_items" ON public.route_client_items;
DROP POLICY IF EXISTS "Authenticated users can delete route_client_items" ON public.route_client_items;
CREATE POLICY "Non-drivers can insert route_client_items" ON public.route_client_items FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update route_client_items" ON public.route_client_items FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete route_client_items" ON public.route_client_items FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- sales
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can delete sales" ON public.sales;
CREATE POLICY "Non-drivers can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update sales" ON public.sales FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete sales" ON public.sales FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- sale_items
DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can update sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can delete sale_items" ON public.sale_items;
CREATE POLICY "Non-drivers can insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- stock_entries
DROP POLICY IF EXISTS "Authenticated users can insert stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Authenticated users can update stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Authenticated users can delete stock_entries" ON public.stock_entries;
CREATE POLICY "Non-drivers can insert stock_entries" ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update stock_entries" ON public.stock_entries FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete stock_entries" ON public.stock_entries FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- stock_losses (single ALL policy currently)
DROP POLICY IF EXISTS "Authenticated users can manage stock_losses" ON public.stock_losses;
CREATE POLICY "Authenticated users can view stock_losses" ON public.stock_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can insert stock_losses" ON public.stock_losses FOR INSERT TO authenticated WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can update stock_losses" ON public.stock_losses FOR UPDATE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver')) WITH CHECK (NOT public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Non-drivers can delete stock_losses" ON public.stock_losses FOR DELETE TO authenticated USING (NOT public.has_role(auth.uid(), 'driver'));

-- user_approvals: prevent drivers from updating
DROP POLICY IF EXISTS "Approved users can update approvals" ON public.user_approvals;
CREATE POLICY "Approved non-drivers can update approvals"
  ON public.user_approvals FOR UPDATE TO authenticated
  USING (public.is_approved_user(auth.uid()) AND NOT public.has_role(auth.uid(), 'driver'))
  WITH CHECK (public.is_approved_user(auth.uid()) AND NOT public.has_role(auth.uid(), 'driver'));