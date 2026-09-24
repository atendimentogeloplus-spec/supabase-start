REVOKE EXECUTE ON FUNCTION public.guard_protected_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_protected_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_protected_user(uuid) FROM authenticated;