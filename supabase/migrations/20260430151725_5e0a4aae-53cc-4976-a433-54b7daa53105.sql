-- Add billing_method column to clients table
ALTER TABLE public.clients 
ADD COLUMN billing_method TEXT NOT NULL DEFAULT 'pix'
CHECK (billing_method IN ('pix', 'boleto'));

-- Ensure all existing clients have 'pix' (already covered by DEFAULT, but being explicit)
UPDATE public.clients SET billing_method = 'pix' WHERE billing_method IS NULL;