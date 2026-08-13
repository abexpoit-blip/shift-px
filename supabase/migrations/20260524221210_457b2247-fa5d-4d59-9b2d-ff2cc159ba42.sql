
REVOKE EXECUTE ON FUNCTION public.record_bot_fingerprint(TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bot_fingerprint(TEXT, BOOLEAN, TEXT, TEXT, TEXT, INTEGER) TO service_role;
