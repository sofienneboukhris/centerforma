REVOKE EXECUTE ON FUNCTION public.can_read_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_document(text) TO authenticated, service_role;