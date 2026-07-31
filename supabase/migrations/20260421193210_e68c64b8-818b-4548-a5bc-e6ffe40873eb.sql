-- 1) Remove duplicate triggers, keep only the consolidated one
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_ins ON public.sale_items;
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_upd ON public.sale_items;
DROP TRIGGER IF EXISTS trg_adjust_stock_on_sale_item_del ON public.sale_items;

-- 2) Recalculate products.stock_quantity from the source of truth:
--    produced (stock_entries) - losses (stock_losses) - sold (sale_items)
WITH produced AS (
  SELECT product_id, COALESCE(SUM(quantity), 0)::int AS qty
  FROM public.stock_entries GROUP BY product_id
),
lost AS (
  SELECT product_id, COALESCE(SUM(quantity), 0)::int AS qty
  FROM public.stock_losses GROUP BY product_id
),
sold AS (
  SELECT product_id, COALESCE(SUM(quantity), 0)::int AS qty
  FROM public.sale_items GROUP BY product_id
)
UPDATE public.products p
SET stock_quantity = GREATEST(
  0,
  COALESCE((SELECT qty FROM produced WHERE product_id = p.id), 0)
  - COALESCE((SELECT qty FROM lost WHERE product_id = p.id), 0)
  - COALESCE((SELECT qty FROM sold WHERE product_id = p.id), 0)
);

-- 3) Add triggers so production entries and losses also keep
--    products.stock_quantity in sync automatically (single source of truth).
CREATE OR REPLACE FUNCTION public.adjust_stock_on_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity + NEW.quantity
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity)
      WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity)
        WHERE id = OLD.product_id;
      UPDATE public.products
        SET stock_quantity = stock_quantity + NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF NEW.quantity <> OLD.quantity THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity + (NEW.quantity - OLD.quantity))
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_loss()
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

DROP TRIGGER IF EXISTS trg_adjust_stock_on_entry ON public.stock_entries;
CREATE TRIGGER trg_adjust_stock_on_entry
AFTER INSERT OR UPDATE OR DELETE ON public.stock_entries
FOR EACH ROW
EXECUTE FUNCTION public.adjust_stock_on_entry();

DROP TRIGGER IF EXISTS trg_adjust_stock_on_loss ON public.stock_losses;
CREATE TRIGGER trg_adjust_stock_on_loss
AFTER INSERT OR UPDATE OR DELETE ON public.stock_losses
FOR EACH ROW
EXECUTE FUNCTION public.adjust_stock_on_loss();