-- Create cash_flow table
CREATE TABLE public.cash_flow (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing authenticated users for simplicity, consistent with other tables in this project)
CREATE POLICY "Enable read access for authenticated users" 
ON public.cash_flow FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON public.cash_flow FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON public.cash_flow FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON public.cash_flow FOR DELETE 
TO authenticated 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_cash_flow_updated_at
BEFORE UPDATE ON public.cash_flow
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();