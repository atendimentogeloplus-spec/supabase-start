
-- Protect the developer account atendimentogeloplus@gmail.com from any revocation, role change, or deletion

CREATE OR REPLACE FUNCTION public.protect_dev_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev_id uuid;
  v_target uuid;
  v_new_status text;
  v_old_status text;
BEGIN
  SELECT id INTO v_dev_id FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_dev_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_target := OLD.user_id;
  ELSE
    v_target := NEW.user_id;
  END IF;

  IF v_target <> v_dev_id THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser alterada.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode perder o perfil admin.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'user_approvals' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser removida.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser revogada.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS protect_dev_user_roles ON public.user_roles;
CREATE TRIGGER protect_dev_user_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_dev_account();

DROP TRIGGER IF EXISTS protect_dev_user_approvals ON public.user_approvals;
CREATE TRIGGER protect_dev_user_approvals
BEFORE UPDATE OR DELETE ON public.user_approvals
FOR EACH ROW EXECUTE FUNCTION public.protect_dev_account();

-- Ensure dev account is always approved and admin (if it exists)
DO $$
DECLARE v_dev_id uuid;
BEGIN
  SELECT id INTO v_dev_id FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_dev_id IS NOT NULL THEN
    INSERT INTO public.user_approvals (user_id, email, status)
    VALUES (v_dev_id, 'atendimentogeloplus@gmail.com', 'approved')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_dev_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
