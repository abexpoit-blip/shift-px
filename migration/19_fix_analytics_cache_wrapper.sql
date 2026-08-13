-- =============================================================================
-- Migration 19: Fix migration 18 — cache wrapper failed to apply because
-- the old get_analytics_summary had different parameter defaults.
-- CREATE OR REPLACE can't change defaults → must DROP first.
-- Symptom: every /analytics call still ~23s (no cache hit).
-- =============================================================================

SET statement_timeout = 0;

-- Drop both signatures (old fn may have defaults like _days integer DEFAULT 7)
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

-- Recreate cached wrapper (same body as migration 18 PART B)
CREATE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_payload jsonb;
  v_updated timestamptz;
  v_cached_days integer;
  v_ttl interval := interval '2 minutes';
BEGIN
  SELECT payload, updated_at, days
    INTO v_payload, v_updated, v_cached_days
  FROM analytics_cache
  WHERE user_id = _user_id;

  IF v_payload IS NOT NULL
     AND v_cached_days = _days
     AND v_updated > now() - v_ttl
  THEN
    RETURN v_payload;
  END IF;

  v_payload := public._compute_analytics_summary(_user_id, _days);

  INSERT INTO analytics_cache (user_id, days, payload, updated_at)
  VALUES (_user_id, _days, v_payload, now())
  ON CONFLICT (user_id) DO UPDATE
    SET payload    = EXCLUDED.payload,
        days       = EXCLUDED.days,
        updated_at = EXCLUDED.updated_at;

  RETURN v_payload;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Verify: function source should contain 'analytics_cache' (cached wrapper)
SELECT
  proname,
  CASE WHEN prosrc LIKE '%analytics_cache%' THEN 'CACHED ✓' ELSE 'NOT CACHED ✗' END AS status
FROM pg_proc
WHERE proname = 'get_analytics_summary';
