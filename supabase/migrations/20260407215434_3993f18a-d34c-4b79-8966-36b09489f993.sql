
DELETE FROM public.sale_items WHERE sale_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY client_name, batch_number, total, created_at ORDER BY id) as rn
    FROM public.sales
    WHERE created_at >= '2025-08-01' AND created_at < '2025-09-01'
  ) dupes WHERE rn > 1
);
DELETE FROM public.sales WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY client_name, batch_number, total, created_at ORDER BY id) as rn
    FROM public.sales
    WHERE created_at >= '2025-08-01' AND created_at < '2025-09-01'
  ) dupes WHERE rn > 1
);
