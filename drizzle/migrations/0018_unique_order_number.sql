CREATE OR REPLACE FUNCTION public.prevent_duplicate_order_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.number := btrim(NEW.number);
  IF TG_OP = 'UPDATE' AND NEW.number IS NOT DISTINCT FROM btrim(OLD.number) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('po_number:' || lower(NEW.number)));
  IF EXISTS (SELECT 1 FROM public.purchase_orders WHERE lower(btrim(number)) = lower(NEW.number) AND id <> NEW.id) THEN
    RAISE EXCEPTION 'Já existe um pedido com o número %. Use outro número.', NEW.number;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_orders_unique_number BEFORE INSERT OR UPDATE OF number ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_order_number();