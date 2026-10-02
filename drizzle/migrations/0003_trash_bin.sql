CREATE TABLE public.trash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  label text,
  data jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.trash TO authenticated;
GRANT ALL ON public.trash TO service_role;
ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;
CREATE POLICY trash_admin_read ON public.trash FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY trash_admin_delete ON public.trash FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.move_to_trash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.trash WHERE deleted_at < now() - interval '30 days';
  INSERT INTO public.trash (table_name, record_id, label, data, deleted_by)
  VALUES (TG_TABLE_NAME, OLD.id,
    CASE WHEN TG_TABLE_NAME = 'leads' THEN coalesce(to_jsonb(OLD)->>'company', to_jsonb(OLD)->>'contact_name') ELSE to_jsonb(OLD)->>'name' END,
    to_jsonb(OLD), auth.uid());
  RETURN OLD;
END $$;

CREATE TRIGGER trash_clients BEFORE DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.move_to_trash();
CREATE TRIGGER trash_leads BEFORE DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.move_to_trash();

CREATE OR REPLACE FUNCTION public.restore_from_trash(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.trash; d jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO t FROM public.trash WHERE id = _id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  d := t.data;
  IF t.table_name = 'leads' THEN
    IF d->>'client_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE id = (d->>'client_id')::uuid) THEN d := d || '{"client_id":null}'; END IF;
    FOREACH t.label IN ARRAY ARRAY['owner_id','first_owner_id','created_by'] LOOP
      IF d->>t.label IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (d->>t.label)::uuid) THEN d := d || jsonb_build_object(t.label, null); END IF;
    END LOOP;
    IF d->>'source_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sources WHERE id = (d->>'source_id')::uuid) THEN d := d || '{"source_id":null}'; END IF;
    INSERT INTO public.leads SELECT * FROM jsonb_populate_record(NULL::public.leads, d);
  ELSIF t.table_name = 'clients' THEN
    IF d->>'lead_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads WHERE id = (d->>'lead_id')::uuid) THEN d := d || '{"lead_id":null}'; END IF;
    IF d->>'owner_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (d->>'owner_id')::uuid) THEN d := d || '{"owner_id":null}'; END IF;
    INSERT INTO public.clients SELECT * FROM jsonb_populate_record(NULL::public.clients, d);
    UPDATE public.leads SET client_id = (d->>'id')::uuid WHERE id = (d->>'lead_id')::uuid AND client_id IS NULL;
  END IF;
  DELETE FROM public.trash WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.restore_from_trash(uuid) TO authenticated;