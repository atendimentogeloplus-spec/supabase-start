CREATE OR REPLACE FUNCTION public.skip_developer_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id AND lower(email) = 'renato.c2eventos@gmail.com') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS skip_developer_notifications ON public.notifications;
CREATE TRIGGER skip_developer_notifications BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.skip_developer_notifications();
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email)='renato.c2eventos@gmail.com');
DELETE FROM public.push_subscriptions WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email)='renato.c2eventos@gmail.com');