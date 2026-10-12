REVOKE EXECUTE ON FUNCTION public.can_read_document(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_my_student(uuid, uuid) FROM anon;