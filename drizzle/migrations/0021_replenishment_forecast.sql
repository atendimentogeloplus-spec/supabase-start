ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref text;
CREATE INDEX IF NOT EXISTS notifications_ref_idx ON public.notifications(ref);

-- Previsão por cliente + produto, baseada no ritmo real de consumo (ponderado pelo histórico recente)
CREATE OR REPLACE FUNCTION public.replenishment_forecasts()
RETURNS TABLE(client_id uuid, product_id uuid, shipments int, last_date date, last_qty numeric,
              daily_rate numeric, next_date date, mode text, has_new_order boolean)
LANGUAGE sql STABLE SET search_path = public AS $$
WITH ship AS (
  SELECT m.client_id, m.product_id, (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date d, sum(m.quantity) q
  FROM stock_movements m
  WHERE m.modality = 'guarda' AND m.kind = 'saida' AND m.client_id IS NOT NULL
  GROUP BY 1,2,3
), seq AS (
  SELECT s.*, lead(s.d) OVER w nd, count(*) OVER (PARTITION BY s.client_id, s.product_id) n,
         row_number() OVER (PARTITION BY s.client_id, s.product_id ORDER BY s.d DESC) rk
  FROM ship s WINDOW w AS (PARTITION BY s.client_id, s.product_id ORDER BY s.d)
), rate AS (
  -- cada intervalo: quanto foi enviado / quantos dias durou; intervalos recentes pesam mais (meia-vida ~3 meses)
  SELECT client_id, product_id,
         sum(q * exp(-(current_date - nd)/90.0)) / nullif(sum((nd - d) * exp(-(current_date - nd)/90.0)), 0) r
  FROM seq WHERE nd IS NOT NULL AND nd > d GROUP BY 1,2
), last AS (SELECT * FROM seq WHERE rk = 1)
SELECT l.client_id, l.product_id, l.n::int, l.d, l.q, round(r.r, 3),
       CASE WHEN cf.mode = 'manual' THEN cf.manual_date
            WHEN r.r > 0 THEN l.d + ceil(l.q / r.r)::int END,
       coalesce(cf.mode, 'auto'),
       EXISTS (SELECT 1 FROM purchase_orders po WHERE po.client_id = l.client_id
               AND (po.created_at AT TIME ZONE 'America/Sao_Paulo')::date > l.d)
FROM last l
LEFT JOIN rate r ON r.client_id = l.client_id AND r.product_id = l.product_id
LEFT JOIN client_forecasts cf ON cf.client_id = l.client_id
$$;
GRANT EXECUTE ON FUNCTION public.replenishment_forecasts() TO authenticated;

-- Avisos à vendedora do cliente: 35, 15 e 5 dias antes; param se já houver novo pedido
CREATE OR REPLACE FUNCTION public.notify_replenishment()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  WITH f AS (
    SELECT f.*, c.owner_id, c.name cname, p.name pname, f.next_date - current_date left_days
    FROM replenishment_forecasts() f
    JOIN clients c ON c.id = f.client_id
    JOIN products p ON p.id = f.product_id
    WHERE c.owner_id IS NOT NULL AND f.next_date IS NOT NULL AND NOT f.has_new_order
  ), staged AS (
    SELECT f.*, CASE WHEN left_days <= 5 THEN 5 WHEN left_days <= 15 THEN 15 WHEN left_days <= 35 THEN 35 END stage
    FROM f WHERE left_days >= 0 AND left_days <= 35
  ), ins AS (
    INSERT INTO notifications(user_id, type, title, body, ref)
    SELECT s.owner_id, 'replenishment',
           CASE s.stage WHEN 35 THEN 'Reposição em ' WHEN 15 THEN 'Reforço: reposição em ' ELSE 'Último aviso: reposição em ' END
             || s.left_days || ' dias',
           s.cname || ' — ' || s.pname || ' (previsto para ' || to_char(s.next_date, 'DD/MM/YYYY') || ')',
           'repl:' || s.client_id || ':' || s.product_id || ':' || s.last_date || ':' || s.stage
    FROM staged s
    WHERE NOT EXISTS (SELECT 1 FROM notifications x
                      WHERE x.ref = 'repl:' || s.client_id || ':' || s.product_id || ':' || s.last_date || ':' || s.stage)
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_replenishment() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('notify-replenishment', '0 12 * * *', 'SELECT public.notify_replenishment()');