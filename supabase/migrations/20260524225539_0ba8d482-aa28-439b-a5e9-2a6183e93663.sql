
REVOKE ALL ON FUNCTION public.record_redirect_click(uuid, uuid, text, text, text, boolean, text, text, text, text, text, text, text, text, integer, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_click(uuid, uuid, text, text, text, boolean, text, text, text, text, text, text, text, text, integer, jsonb, boolean) TO service_role;
