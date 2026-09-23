ALTER TABLE public.leads ADD COLUMN converted_at timestamptz, ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.convert_won_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_client uuid;
BEGIN
  IF NEW.converted_at IS NULL AND NEW.status IS DISTINCT FROM OLD.status
     AND EXISTS (SELECT 1 FROM public.kanban_columns WHERE key = NEW.status AND is_won) THEN
    INSERT INTO public.clients (name, contact_name, phone, email, notes, owner_id, lead_id)
    VALUES (coalesce(NEW.company, NEW.contact_name), NEW.contact_name, NEW.phone, NEW.email, NEW.notes, NEW.owner_id, NEW.id)
    RETURNING id INTO new_client;
    NEW.converted_at := now();
    NEW.client_id := new_client;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.convert_won_lead() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_convert_won_lead BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.convert_won_lead();