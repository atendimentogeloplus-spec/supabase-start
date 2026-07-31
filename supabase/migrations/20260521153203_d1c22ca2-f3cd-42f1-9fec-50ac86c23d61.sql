-- Create freezers table
CREATE TABLE public.freezers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  freezer_type TEXT NOT NULL CHECK (freezer_type IN ('horizontal', 'vertical')),
  serial_number TEXT,
  contract_signed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for freezers
ALTER TABLE public.freezers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public freezers access" ON public.freezers FOR ALL USING (true);

-- Create freezer maintenance logs table
CREATE TABLE public.freezer_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freezer_id UUID NOT NULL REFERENCES public.freezers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for freezer maintenance
ALTER TABLE public.freezer_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public freezer_maintenance access" ON public.freezer_maintenance FOR ALL USING (true);

-- Create trigger for updated_at on freezers
CREATE TRIGGER update_freezers_updated_at
BEFORE UPDATE ON public.freezers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();