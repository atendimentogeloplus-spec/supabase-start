
-- Create routes table
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_clients table
CREATE TABLE public.route_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(route_id, client_id)
);

-- Enable RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for routes
CREATE POLICY "Authenticated users can view routes" ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert routes" ON public.routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update routes" ON public.routes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete routes" ON public.routes FOR DELETE TO authenticated USING (true);

-- RLS policies for route_clients
CREATE POLICY "Authenticated users can view route_clients" ON public.route_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert route_clients" ON public.route_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update route_clients" ON public.route_clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete route_clients" ON public.route_clients FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at on routes
CREATE TRIGGER update_routes_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_route_clients_route_id ON public.route_clients(route_id);
CREATE INDEX idx_route_clients_position ON public.route_clients(route_id, position);
