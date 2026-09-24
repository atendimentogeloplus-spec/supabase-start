CREATE OR REPLACE FUNCTION public.is_protected_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _uid AND lower(email) = 'renato.c2eventos@gmail.com')
$$;
REVOKE EXECUTE ON FUNCTION public.is_protected_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_protected_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_protected_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_protected_user(OLD.id) THEN RAISE EXCEPTION 'Usuário desenvolvedor protegido.'; END IF;
    RETURN OLD;
  END IF;
  IF public.is_protected_user(NEW.id) AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'Usuário desenvolvedor protegido.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_protected_profile BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_protected_profile();

CREATE OR REPLACE FUNCTION public.guard_protected_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_protected_user(OLD.user_id) AND OLD.role = 'admin'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'Usuário desenvolvedor protegido.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_protected_role BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_protected_role();

UPDATE public.profiles SET status = 'active' WHERE public.is_protected_user(id);
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'renato.c2eventos@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;