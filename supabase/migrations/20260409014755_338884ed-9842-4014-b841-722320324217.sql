
CREATE TABLE public.route_client_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_client_id UUID NOT NULL REFERENCES public.route_clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_table_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.route_client_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view route_client_items" ON public.route_client_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert route_client_items" ON public.route_client_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update route_client_items" ON public.route_client_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete route_client_items" ON public.route_client_items FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_route_client_items_rc ON public.route_client_items(route_client_id);
