ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delete_reason text;
CREATE OR REPLACE FUNCTION public.require_order_delete_reason() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() AND public.has_role(auth.uid(), 'rep_level2') AND COALESCE(btrim(OLD.delete_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe a justificativa da exclusão';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER purchase_orders_require_delete_reason BEFORE DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.require_order_delete_reason();