-- Trigger to automatically adjust product stock when sale_items change
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
    -- If product changed, return qty to old product and subtract from new product
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

DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_ins ON public.sale_items;
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_del ON public.sale_items;
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_upd ON public.sale_items;

CREATE TRIGGER trg_adjust_stock_on_sale_item_ins
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale_item();

CREATE TRIGGER trg_adjust_stock_on_sale_item_del
AFTER DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale_item();

CREATE TRIGGER trg_adjust_stock_on_sale_item_upd
AFTER UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale_item();