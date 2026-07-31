
CREATE OR REPLACE FUNCTION public.generate_boleto_receivables()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_cutoff date := DATE '2026-07-03';
  v_inserted int := 0;
  r record;
  v_tag text;
  v_due date;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT c.id AS client_id, c.name AS client_name,
           date_trunc('month', (s.created_at AT TIME ZONE 'America/Sao_Paulo'))::date AS period_start,
           SUM(s.total)::numeric AS total
    FROM sales s JOIN clients c ON c.id = s.client_id
    WHERE c.billing_method = 'boleto' AND c.payment_type = 'mensal'
    GROUP BY c.id, c.name, period_start
  LOOP
    v_due := (r.period_start + INTERVAL '1 month' + INTERVAL '4 days')::date;
    IF v_due < v_cutoff THEN CONTINUE; END IF;
    IF (r.period_start + INTERVAL '1 month')::date > v_today THEN CONTINUE; END IF;

    v_tag := '[auto-boleto:mensal:' || to_char(r.period_start,'YYYY-MM') || ':' || r.client_id::text || ']';
    IF EXISTS (SELECT 1 FROM fin_receivables WHERE notes LIKE '%' || v_tag || '%') THEN CONTINUE; END IF;

    INSERT INTO fin_receivables(user_id, description, client_name, amount, due_date, category, payment_method, notes, status)
    VALUES (v_owner, 'Fechamento mensal ' || to_char(r.period_start,'MM/YYYY') || ' - ' || r.client_name,
            r.client_name, r.total, v_due, 'Vendas de Gelo', 'Boleto', v_tag, 'aberto');
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT c.id AS client_id, c.name AS client_name,
           date_trunc('month', (s.created_at AT TIME ZONE 'America/Sao_Paulo'))::date AS month_start,
           CASE WHEN EXTRACT(day FROM (s.created_at AT TIME ZONE 'America/Sao_Paulo')) <= 15 THEN 1 ELSE 2 END AS half,
           SUM(s.total)::numeric AS total
    FROM sales s JOIN clients c ON c.id = s.client_id
    WHERE c.billing_method = 'boleto' AND c.payment_type = 'quinzenal'
    GROUP BY c.id, c.name, month_start, half
  LOOP
    IF r.half = 1 THEN
      v_due := (r.month_start + INTERVAL '19 days')::date;
      IF v_today <= (r.month_start + INTERVAL '15 days')::date THEN CONTINUE; END IF;
    ELSE
      v_due := (r.month_start + INTERVAL '1 month' + INTERVAL '4 days')::date;
      IF v_today < (r.month_start + INTERVAL '1 month')::date THEN CONTINUE; END IF;
    END IF;
    IF v_due < v_cutoff THEN CONTINUE; END IF;

    v_tag := '[auto-boleto:quinzenal:' || to_char(r.month_start,'YYYY-MM') || ':H' || r.half || ':' || r.client_id::text || ']';
    IF EXISTS (SELECT 1 FROM fin_receivables WHERE notes LIKE '%' || v_tag || '%') THEN CONTINUE; END IF;

    INSERT INTO fin_receivables(user_id, description, client_name, amount, due_date, category, payment_method, notes, status)
    VALUES (v_owner, 'Fechamento quinzenal ' || to_char(r.month_start,'MM/YYYY') || ' H' || r.half || ' - ' || r.client_name,
            r.client_name, r.total, v_due, 'Vendas de Gelo', 'Boleto', v_tag, 'aberto');
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;
