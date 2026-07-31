
CREATE OR REPLACE FUNCTION public.fin_mirror_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fin_categories (user_id, name, type, color)
  VALUES (v_owner, 'Vendas de Gelo', 'entrada', '#16a34a')
  ON CONFLICT (user_id, name, type) DO NOTHING;

  INSERT INTO public.fin_transactions (
    user_id, description, amount, type, category, date, status, payment_method, notes, origin_cash_flow_id
  ) VALUES (
    v_owner,
    COALESCE(NEW.client_name, NEW.description, 'Recebimento Comercial'),
    NEW.amount,
    'entrada',
    'Vendas de Gelo',
    COALESCE(NEW.payment_date::date, CURRENT_DATE),
    'realizado',
    COALESCE(NEW.payment_method, 'dinheiro'),
    COALESCE(NEW.description, '') || ' (origem: comercial #' || NEW.id::text || ')',
    NEW.id
  )
  ON CONFLICT (origin_cash_flow_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

UPDATE public.fin_transactions ft
SET description = COALESCE(cf.client_name, ft.description),
    notes = COALESCE(cf.description, '') || ' (origem: comercial #' || cf.id::text || ')'
FROM public.cash_flow cf
WHERE ft.origin_cash_flow_id = cf.id
  AND cf.client_name IS NOT NULL;
