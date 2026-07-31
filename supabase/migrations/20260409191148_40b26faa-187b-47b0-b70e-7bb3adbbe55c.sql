
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_selected_year integer, p_selected_month integer, p_today date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_year_start timestamptz;
  v_year_end timestamptz;
  v_prev_year_month_start timestamptz;
  v_prev_year_month_end timestamptz;
  v_prev_year_start timestamptz;
  v_prev_year_end timestamptz;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_week_start date;
  v_quarter_index int;
  v_prev_quarter_index int;
  v_prev_quarter_year int;
  v_pq_start_month int;
  v_quarter_start timestamptz;
  v_quarter_end timestamptz;
  v_mtd_day int;
  v_mtd_end timestamptz;
  v_mtd_prev_start timestamptz;
  v_mtd_prev_end timestamptz;
  v_ytd_end timestamptz;
  v_ytd_prev_start timestamptz;
  v_ytd_prev_end timestamptz;
  v_ytd_ref_month int;
  v_ytd_ref_day int;
BEGIN
  v_month_start := make_timestamptz(p_selected_year, p_selected_month + 1, 1, 0, 0, 0);
  v_month_end := (v_month_start + interval '1 month') - interval '1 microsecond';
  v_year_start := make_timestamptz(p_selected_year, 1, 1, 0, 0, 0);
  v_year_end := make_timestamptz(p_selected_year, 12, 31, 23, 59, 59);
  v_prev_year_month_start := make_timestamptz(p_selected_year - 1, p_selected_month + 1, 1, 0, 0, 0);
  v_prev_year_month_end := (v_prev_year_month_start + interval '1 month') - interval '1 microsecond';
  v_prev_year_start := make_timestamptz(p_selected_year - 1, 1, 1, 0, 0, 0);
  v_prev_year_end := make_timestamptz(p_selected_year - 1, 12, 31, 23, 59, 59);
  
  v_today_start := (p_today::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_today_end := (p_today::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  
  v_week_start := p_today - extract(dow from p_today)::int;
  IF NOT (p_selected_year = extract(year from p_today)::int AND p_selected_month = extract(month from p_today)::int - 1) THEN
    v_week_start := make_date(p_selected_year, p_selected_month + 1, 1) - extract(dow from make_date(p_selected_year, p_selected_month + 1, 1))::int;
  END IF;

  -- Month-to-date
  IF p_selected_year = extract(year from p_today)::int AND p_selected_month = extract(month from p_today)::int - 1 THEN
    v_mtd_day := extract(day from p_today)::int;
  ELSE
    v_mtd_day := extract(day from (v_month_end AT TIME ZONE 'America/Sao_Paulo'))::int;
  END IF;
  
  v_mtd_end := (make_date(p_selected_year, p_selected_month + 1, v_mtd_day)::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_mtd_prev_start := make_timestamptz(p_selected_year - 1, p_selected_month + 1, 1, 0, 0, 0);
  v_mtd_prev_end := (make_date(p_selected_year - 1, p_selected_month + 1, LEAST(v_mtd_day, extract(day from (v_mtd_prev_start + interval '1 month' - interval '1 day'))::int))::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- Year-to-date: Jan 1 to selected month+day (or end of selected month if past)
  IF p_selected_year = extract(year from p_today)::int THEN
    v_ytd_ref_month := extract(month from p_today)::int;
    v_ytd_ref_day := extract(day from p_today)::int;
  ELSE
    v_ytd_ref_month := 12;
    v_ytd_ref_day := 31;
  END IF;
  v_ytd_end := (make_date(p_selected_year, v_ytd_ref_month, v_ytd_ref_day)::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ytd_prev_start := make_timestamptz(p_selected_year - 1, 1, 1, 0, 0, 0);
  v_ytd_prev_end := (make_date(p_selected_year - 1, v_ytd_ref_month, LEAST(v_ytd_ref_day, extract(day from (make_date(p_selected_year - 1, v_ytd_ref_month, 1) + interval '1 month' - interval '1 day'))::int))::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  v_quarter_index := p_selected_month / 3;
  IF v_quarter_index = 0 THEN
    v_prev_quarter_index := 3;
    v_prev_quarter_year := p_selected_year - 1;
  ELSE
    v_prev_quarter_index := v_quarter_index - 1;
    v_prev_quarter_year := p_selected_year;
  END IF;
  v_pq_start_month := v_prev_quarter_index * 3 + 1;
  v_quarter_start := make_timestamptz(v_prev_quarter_year, v_pq_start_month, 1, 0, 0, 0);
  v_quarter_end := (make_timestamptz(v_prev_quarter_year, v_pq_start_month + 2, 1, 0, 0, 0) + interval '1 month') - interval '1 microsecond';

  SELECT jsonb_build_object(
    'todayTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_today_start AND v_today_end), 0),
    'todayCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_today_start AND v_today_end),
    'todayPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_today_start AND v_today_end), 0),
    'monthTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end), 0),
    'monthCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end),
    'monthPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_month_start AND v_month_end), 0),
    'monthClients', (SELECT count(DISTINCT client_id) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end AND client_id IS NOT NULL),
    'prevMonthTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end), 0),
    'prevMonthCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end),
    'prevMonthPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end), 0),
    'prevMonthClients', (SELECT count(DISTINCT client_id) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end AND client_id IS NOT NULL),
    'yearTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_year_start AND v_year_end), 0),
    'yearCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_year_start AND v_year_end),
    'yearPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_year_start AND v_year_end), 0),
    'prevYearTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_prev_year_start AND v_prev_year_end), 0),
    'prevYearCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_prev_year_start AND v_prev_year_end),
    'prevYearPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_prev_year_start AND v_prev_year_end), 0),
    'mtdTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_month_start AND v_mtd_end), 0),
    'mtdCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_month_start AND v_mtd_end),
    'mtdPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_month_start AND v_mtd_end), 0),
    'mtdPrevTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end), 0),
    'mtdPrevCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end),
    'mtdPrevPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end), 0),
    'mtdDay', v_mtd_day,
    'ytdTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_year_start AND v_ytd_end), 0),
    'ytdCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_year_start AND v_ytd_end),
    'ytdPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_year_start AND v_ytd_end), 0),
    'ytdPrevTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end), 0),
    'ytdPrevCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end),
    'ytdPrevPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end), 0),
    'ytdLabel', to_char(make_date(p_selected_year, 1, 1), 'DD/MM') || ' a ' || to_char(make_date(p_selected_year, v_ytd_ref_month, v_ytd_ref_day), 'DD/MM'),
    'topProducts', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.qty DESC)
      FROM (
        SELECT si.product_name as name, sum(si.quantity)::int as qty, sum(si.subtotal)::numeric as revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at BETWEEN v_month_start AND v_month_end
        GROUP BY si.product_name ORDER BY qty DESC LIMIT 7
      ) t
    ), '[]'::jsonb),
    'weekDays', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.d)
      FROM (
        SELECT d,
          to_char(d, 'Dy') as name,
          COALESCE(sum(s.total), 0)::numeric as total,
          COALESCE(sum(si_qty.qty), 0)::int as pacotes
        FROM generate_series(v_week_start::date, v_week_start::date + 6, '1 day'::interval) d
        LEFT JOIN sales s ON s.created_at >= d AND s.created_at < d + interval '1 day'
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        GROUP BY d ORDER BY d
      ) t
    ),
    'monthlyComparison', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.m)
      FROM (
        SELECT m,
          substr(to_char(make_date(p_selected_year, m, 1), 'Month'), 1, 3) as name,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year THEN s.total END), 0)::numeric as atual,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN s.total END), 0)::numeric as anterior,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year THEN si_qty.qty END), 0)::int as "pacotesAtual",
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN si_qty.qty END), 0)::int as "pacotesAnterior",
          count(CASE WHEN extract(year from s.created_at) = p_selected_year THEN 1 END)::int as "pedidosAtual",
          count(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN 1 END)::int as "pedidosAnterior"
        FROM generate_series(1, 12) m
        LEFT JOIN sales s ON extract(month from s.created_at) = m 
          AND extract(year from s.created_at) IN (p_selected_year, p_selected_year - 1)
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        GROUP BY m ORDER BY m
      ) t
    ),
    'dailyChart', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.d)
      FROM (
        SELECT d, to_char(d, 'DD') as day, COALESCE(sum(s.total), 0)::numeric as total
        FROM generate_series(v_month_start::date, (v_month_end)::date, '1 day'::interval) d
        LEFT JOIN sales s ON s.created_at >= d AND s.created_at < d + interval '1 day'
        GROUP BY d ORDER BY d
      ) t
    ),
    'monthLossQty', COALESCE((SELECT sum(quantity) FROM stock_losses WHERE loss_date >= v_month_start::date AND loss_date <= v_month_end::date), 0),
    'lossProducts', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.qty DESC)
      FROM (
        SELECT p.name, sum(sl.quantity)::int as qty
        FROM stock_losses sl JOIN products p ON sl.product_id = p.id
        WHERE sl.loss_date >= v_month_start::date AND sl.loss_date <= v_month_end::date
        GROUP BY p.name ORDER BY qty DESC
      ) t
    ), '[]'::jsonb),
    'topClients', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.revenue DESC)
      FROM (
        SELECT s.client_name as name, sum(s.total)::numeric as revenue,
          COALESCE(sum(si_qty.qty), 0)::int as packages
        FROM sales s
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        WHERE s.created_at BETWEEN v_quarter_start AND v_quarter_end
          AND s.client_name IS NOT NULL
        GROUP BY s.client_name ORDER BY revenue DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'prevQuarterIndex', v_prev_quarter_index,
    'prevQuarterYear', v_prev_quarter_year,
    'pqStartMonth', v_pq_start_month - 1
  ) INTO result;

  RETURN result;
END;
$function$;
