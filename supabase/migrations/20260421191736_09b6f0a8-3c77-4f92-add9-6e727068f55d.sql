-- Recreate function with logging and ensure it handles all cases
CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity + OLD.quantity
      WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.products
        SET stock_quantity = stock_quantity + OLD.quantity
        WHERE id = OLD.product_id;
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
        WHERE id = NEW.product_id;
    ELSIF NEW.quantity <> OLD.quantity THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - (NEW.quantity - OLD.quantity))
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop trigger if it exists (defensive) and create it
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item ON public.sale_items;

CREATE TRIGGER trg_adjust_stock_on_sale_item
AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.adjust_stock_on_sale_item();