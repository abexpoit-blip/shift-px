REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;