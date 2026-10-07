CREATE OR REPLACE FUNCTION public.notify_lead_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE nm text := coalesce(NEW.company, NEW.contact_name);
        actor text := (SELECT name FROM public.profiles WHERE id = auth.uid());
        lbl text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, lead_id)
    SELECT ur.user_id, 'new_lead', 'Novo lead', nm || coalesce(' — por ' || actor, ''), NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id IS DISTINCT FROM auth.uid();
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      SELECT label INTO lbl FROM public.kanban_columns WHERE key = NEW.status;
      INSERT INTO public.notifications(user_id, type, title, body, lead_id)
      SELECT ur.user_id, 'lead_moved', 'Lead movido: ' || coalesce(lbl, NEW.status), nm || coalesce(' — por ' || actor, ''), NEW.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.user_id IS DISTINCT FROM auth.uid();
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO public.notifications(user_id, type, title, body, lead_id)
      SELECT ur.user_id, 'lead_reassigned', 'Responsável alterado',
        nm || ' → ' || coalesce((SELECT name FROM public.profiles WHERE id = NEW.owner_id), 'sem responsável'), NEW.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.user_id IS DISTINCT FROM auth.uid() AND ur.user_id IS DISTINCT FROM NEW.owner_id;
    END IF;
  END IF;
  IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    INSERT INTO public.notifications(user_id, type, title, body, lead_id)
    VALUES (NEW.owner_id, 'lead_assigned', 'Lead atribuído a você', nm, NEW.id);
  END IF;
  RETURN NEW;
END $function$;