
-- Add price directly to price_tables
ALTER TABLE public.price_tables ADD COLUMN price numeric NOT NULL DEFAULT 0;

-- Drop the product_prices table (no longer needed)
DROP TABLE IF EXISTS public.product_prices;
