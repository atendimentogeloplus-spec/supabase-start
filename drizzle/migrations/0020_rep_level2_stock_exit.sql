CREATE OR REPLACE FUNCTION public.register_stock_exit(_product_id uuid, _modality text, _client_id uuid, _quantity numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bal numeric;
BEGIN
  IF NOT (public.is_admin() OR (public.is_active_user() AND (public.is_stockist() OR public.has_role(auth.uid(), 'rep_level2')))) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _modality = 'guarda' AND _client_id IS NULL THEN RAISE EXCEPTION 'Selecione o cliente'; END IF;
  SELECT COALESCE(SUM(CASE WHEN kind='entrada' THEN quantity ELSE -quantity END),0) INTO bal
  FROM public.stock_movements
  WHERE product_id = _product_id AND modality = _modality
    AND (_modality = 'lisos' OR client_id = _client_id);
  IF bal < _quantity THEN RAISE EXCEPTION 'Saldo insuficiente (disponível: %)', bal; END IF;
  INSERT INTO public.stock_movements (product_id, kind, modality, client_id, quantity, note)
  VALUES (_product_id, 'saida', _modality, CASE WHEN _modality='guarda' THEN _client_id END, _quantity, _note);
END $$;