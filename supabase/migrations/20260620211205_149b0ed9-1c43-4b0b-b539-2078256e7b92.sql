CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    RETURN v_data || jsonb_build_object(
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  -- Important: no INSERT/UPDATE here. User-facing analytics reads must stay instant
  -- and must also work in read-only RPC/query contexts.
  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;