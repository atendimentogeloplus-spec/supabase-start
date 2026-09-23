CREATE OR REPLACE FUNCTION public.notify_lead_events()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, lead_id)
    SELECT ur.user_id, 'new_lead', 'Novo lead', coalesce(NEW.company, NEW.contact_name), NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id IS DISTINCT FROM auth.uid()
      AND ur.user_id IS DISTINCT FROM NEW.owner_id;
  END IF;
  IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    INSERT INTO public.notifications(user_id, type, title, body, lead_id)
    VALUES (NEW.owner_id, 'lead_assigned', 'Lead atribuído a você', coalesce(NEW.company, NEW.contact_name), NEW.id);
  END IF;
  RETURN NEW;
END $function$;