
-- Add sequential order number to sales
ALTER TABLE public.sales ADD COLUMN order_number SERIAL;

-- Backfill existing sales in chronological order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.sales
)
UPDATE public.sales s SET order_number = n.rn FROM numbered n WHERE s.id = n.id;
