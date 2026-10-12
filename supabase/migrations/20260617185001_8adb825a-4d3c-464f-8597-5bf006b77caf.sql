REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_formation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_formation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid) TO authenticated;