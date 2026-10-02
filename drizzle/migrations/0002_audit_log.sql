CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  action text NOT NULL,
  record_id uuid,
  label text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; o jsonb;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  o := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  INSERT INTO public.audit_log (user_id, table_name, action, record_id, label, detail)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, (r->>'id')::uuid,
    COALESCE(r->>'number', r->>'name', r->>'contact_name', r->>'kind'),
    CASE WHEN TG_OP = 'UPDATE' THEN (SELECT jsonb_object_agg(k, jsonb_build_array(o->k, r->k)) FROM jsonb_object_keys(r) k WHERE k NOT IN ('updated_at') AND (o->k) IS DISTINCT FROM (r->k)) ELSE r END);
  RETURN NULL;
END $$;

CREATE TRIGGER audit_stock_movements AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_stock_minimums AFTER INSERT OR UPDATE OR DELETE ON public.stock_minimums FOR EACH ROW EXECUTE FUNCTION public.log_change();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_change();