CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_stalled_leads()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d int; n int;
BEGIN
  IF coalesce((SELECT value FROM settings WHERE key='stalled_alert_enabled'),'1') <> '1' THEN RETURN 0; END IF;
  d := coalesce(nullif((SELECT value FROM settings WHERE key='stalled_days'),'')::int, 3);
  WITH stale AS (
    SELECT l.id, coalesce(l.company, l.contact_name) nm, l.owner_id,
           floor(extract(epoch FROM now() - coalesce(l.last_interaction_at, l.created_at))/86400)::int dias,
           (SELECT name FROM profiles WHERE id = l.owner_id) dono
    FROM leads l
    LEFT JOIN kanban_columns k ON k.key = l.status
    WHERE NOT coalesce(k.is_won,false) AND NOT coalesce(k.is_lost,false)
      AND coalesce(l.last_interaction_at, l.created_at) < now() - make_interval(days => d)
  ), targets AS (
    SELECT s.id, s.nm, s.dias, s.dono, s.owner_id AS uid FROM stale s WHERE s.owner_id IS NOT NULL
    UNION
    SELECT s.id, s.nm, s.dias, s.dono, ur.user_id FROM stale s CROSS JOIN user_roles ur WHERE ur.role='admin'
  ), ins AS (
    INSERT INTO notifications(user_id, type, title, body, lead_id)
    SELECT t.uid, 'stalled', 'Lead parado há ' || t.dias || ' dias',
           t.nm || ' — responsável: ' || coalesce(t.dono, 'sem responsável'), t.id
    FROM targets t
    WHERE NOT EXISTS (SELECT 1 FROM notifications x WHERE x.user_id = t.uid AND x.lead_id = t.id
                      AND x.type = 'stalled' AND x.created_at > now() - make_interval(days => d))
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;
  RETURN n;
END $function$;

REVOKE EXECUTE ON FUNCTION public.notify_stalled_leads() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('notify-stalled-leads', '0 12 * * *', 'SELECT public.notify_stalled_leads()');