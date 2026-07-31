CREATE OR REPLACE FUNCTION public.generate_boleto_receivables()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Geração automática de boletos (mensal e quinzenal) desativada.
  -- Nova lógica será implementada em seguida.
  RETURN 0;
END;
$function$;