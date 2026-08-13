REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) TO service_role;