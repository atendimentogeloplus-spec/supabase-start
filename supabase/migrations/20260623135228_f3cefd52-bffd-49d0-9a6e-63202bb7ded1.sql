
CREATE OR REPLACE FUNCTION public.fin_resync_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.fin_transactions WHERE origin_cash_flow_id = NEW.id) INTO v_exists;

  IF v_exists THEN
    UPDATE public.fin_transactions
       SET description = COALESCE(NEW.client_name, NEW.description, 'Recebimento Comercial'),
           amount = NEW.amount,
           date = COALESCE(NEW.payment_date::date, CURRENT_DATE),
           payment_method = COALESCE(NEW.payment_method, 'dinheiro'),
           notes = COALESCE(NEW.description, '') || ' (origem: comercial #' || NEW.id::text || ')',
           updated_at = now()
     WHERE origin_cash_flow_id = NEW.id;
  ELSE
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_mirror_cash_flow_upd ON public.cash_flow;
CREATE TRIGGER trg_fin_mirror_cash_flow_upd
AFTER UPDATE ON public.cash_flow
FOR EACH ROW
EXECUTE FUNCTION public.fin_resync_cash_flow();
