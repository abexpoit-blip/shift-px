-- 1) Cache table
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  user_id uuid NOT NULL,
  days integer NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, days)
);

GRANT ALL ON public.analytics_cache TO service_role;
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only SECURITY DEFINER functions read/write it.

-- 2) get_analytics_summary: cache-first, recompute on miss/stale
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_fresh_after timestamptz := now() - interval '5 minutes';
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  -- Fresh cache hit → instant
  IF v_data IS NOT NULL AND v_updated > v_fresh_after THEN
    RETURN v_data || jsonb_build_object('_cached', true, '_cachedAt', v_updated);
  END IF;

  -- Recompute (slow path)
  v_data := public._compute_analytics_summary(_user_id, _days);

  INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
  VALUES (_user_id, _days, v_data, now())
  ON CONFLICT (user_id, days) DO UPDATE
    SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN v_data || jsonb_build_object('_cached', false, '_cachedAt', now());
END
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;

-- 3) Background refresher: walks every user who has links + recent clicks
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
BEGIN
  -- Generous timeout for this background job
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '5s', true);

  FOR v_user IN
    SELECT DISTINCT l.user_id
    FROM public.links l
    WHERE EXISTS (
      SELECT 1 FROM public.clicks c
      WHERE c.link_id = l.id AND c.created_at > now() - interval '24 hours'
      LIMIT 1
    )
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip one user's failure, keep going
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'tookMs', EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)::int
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache() TO service_role;

-- 4) Schedule the refresher every 2 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'refresh-analytics-cache';

    PERFORM cron.schedule(
      'refresh-analytics-cache',
      '*/2 * * * *',
      $cron$ SELECT public.refresh_active_analytics_cache(); $cron$
    );
  END IF;
END $$;