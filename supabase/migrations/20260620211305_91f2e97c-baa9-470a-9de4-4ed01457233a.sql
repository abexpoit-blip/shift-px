REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;