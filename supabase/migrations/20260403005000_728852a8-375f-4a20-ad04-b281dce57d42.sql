-- Drop all permissive public policies and replace with authenticated-only

-- CLIENTS
DROP POLICY IF EXISTS "Anyone can view clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can delete clients" ON public.clients;

CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- PRODUCTS
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.products;

CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- SALES
DROP POLICY IF EXISTS "Anyone can view sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can insert sales" ON public.sales;

CREATE POLICY "Authenticated users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sales" ON public.sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sales" ON public.sales FOR DELETE TO authenticated USING (true);

-- SALE_ITEMS
DROP POLICY IF EXISTS "Anyone can view sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Anyone can insert sale_items" ON public.sale_items;

CREATE POLICY "Authenticated users can view sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (true);

-- STOCK_ENTRIES
DROP POLICY IF EXISTS "Anyone can view stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Anyone can insert stock_entries" ON public.stock_entries;
DROP POLICY IF EXISTS "Anyone can delete stock_entries" ON public.stock_entries;

CREATE POLICY "Authenticated users can view stock_entries" ON public.stock_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_entries" ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_entries" ON public.stock_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stock_entries" ON public.stock_entries FOR DELETE TO authenticated USING (true);