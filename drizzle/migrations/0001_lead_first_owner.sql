ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
UPDATE public.leads SET first_owner_id = owner_id WHERE first_owner_id IS NULL;
CREATE OR REPLACE FUNCTION public.set_first_owner() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.first_owner_id IS NULL THEN NEW.first_owner_id := NEW.owner_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_first_owner BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_first_owner();