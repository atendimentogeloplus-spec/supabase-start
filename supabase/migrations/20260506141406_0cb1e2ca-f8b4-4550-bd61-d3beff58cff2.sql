ALTER TABLE public.cash_flow ADD COLUMN payment_method TEXT DEFAULT 'Pix';

-- Update existing records to 'Pix' if any
UPDATE public.cash_flow SET payment_method = 'Pix' WHERE payment_method IS NULL;