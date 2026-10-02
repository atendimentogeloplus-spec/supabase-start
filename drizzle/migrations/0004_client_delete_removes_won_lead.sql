CREATE OR REPLACE FUNCTION public.remove_won_lead_of_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.lead_id IS NOT NULL THEN
    DELETE FROM public.leads l
    WHERE l.id = OLD.lead_id
      AND EXISTS (SELECT 1 FROM public.kanban_columns k WHERE k.key = l.status AND k.is_won);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER clients_remove_won_lead AFTER DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.remove_won_lead_of_client();

CREATE OR REPLACE FUNCTION public.restore_from_trash(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.trash; d jsonb; k text; lt uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO t FROM public.trash WHERE id = _id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  d := t.data;
  IF t.table_name = 'leads' THEN
    IF d->>'client_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE id = (d->>'client_id')::uuid) THEN d := d || '{"client_id":null}'; END IF;
    FOREACH k IN ARRAY ARRAY['owner_id','first_owner_id','created_by'] LOOP
      IF d->>k IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (d->>k)::uuid) THEN d := d || jsonb_build_object(k, null); END IF;
    END LOOP;
    IF d->>'source_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sources WHERE id = (d->>'source_id')::uuid) THEN d := d || '{"source_id":null}'; END IF;
    INSERT INTO public.leads SELECT * FROM jsonb_populate_record(NULL::public.leads, d);
  ELSIF t.table_name = 'clients' THEN
    IF d->>'lead_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads WHERE id = (d->>'lead_id')::uuid) THEN
      SELECT id INTO lt FROM public.trash WHERE table_name = 'leads' AND record_id = (d->>'lead_id')::uuid ORDER BY deleted_at DESC LIMIT 1;
      IF lt IS NOT NULL THEN PERFORM public.restore_from_trash(lt); END IF;
    END IF;
    IF d->>'lead_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads WHERE id = (d->>'lead_id')::uuid) THEN d := d || '{"lead_id":null}'; END IF;
    IF d->>'owner_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (d->>'owner_id')::uuid) THEN d := d || '{"owner_id":null}'; END IF;
    INSERT INTO public.clients SELECT * FROM jsonb_populate_record(NULL::public.clients, d);
    UPDATE public.leads SET client_id = (d->>'id')::uuid WHERE id = (d->>'lead_id')::uuid AND client_id IS NULL;
  END IF;
  DELETE FROM public.trash WHERE id = _id;
END $$;