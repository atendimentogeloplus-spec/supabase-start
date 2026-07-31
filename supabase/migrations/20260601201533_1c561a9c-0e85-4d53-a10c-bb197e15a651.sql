ALTER TABLE public.freezers ADD COLUMN IF NOT EXISTS notes text;
DROP TRIGGER IF EXISTS update_freezers_updated_at ON public.freezers;
CREATE TRIGGER update_freezers_updated_at BEFORE UPDATE ON public.freezers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();