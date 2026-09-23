CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_lead_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, title, body)
    SELECT ur.user_id, 'Novo lead', coalesce(NEW.company, NEW.contact_name)
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id IS DISTINCT FROM auth.uid()
      AND ur.user_id IS DISTINCT FROM NEW.owner_id;
  END IF;
  IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    INSERT INTO public.notifications(user_id, title, body)
    VALUES (NEW.owner_id, 'Lead atribuído a você', coalesce(NEW.company, NEW.contact_name));
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_lead_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_lead_events AFTER INSERT OR UPDATE OF owner_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_events();

CREATE OR REPLACE FUNCTION public.push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--ba85cc03-d5ea-472d-a1ad-1700cc8431d2.lovable.app/api/public/push',
    body := jsonb_build_object('id', NEW.id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.push_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_push_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_notification();