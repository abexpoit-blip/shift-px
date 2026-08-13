-- Final repair for older self-hosted analytics_cache tables:
-- some installs have PRIMARY KEY (user_id) instead of PRIMARY KEY (user_id, days),
-- which makes refresh_active_analytics_cache fail even after adding a separate unique index.

ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache
SET days = 7
WHERE days IS NULL;

DELETE FROM public.analytics_cache a
USING public.analytics_cache b
WHERE a.user_id = b.user_id
  AND a.days = b.days
  AND (
    COALESCE(a.updated_at, '-infinity'::timestamptz) < COALESCE(b.updated_at, '-infinity'::timestamptz)
    OR (COALESCE(a.updated_at, '-infinity'::timestamptz) = COALESCE(b.updated_at, '-infinity'::timestamptz) AND a.ctid < b.ctid)
  );

ALTER TABLE public.analytics_cache
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN days SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
BEGIN
  SELECT c.conname, array_agg(a.attname ORDER BY u.ord)
  INTO v_pk_name, v_pk_cols
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.analytics_cache'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['user_id', 'days'] THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.analytics_cache'::regclass
      AND contype = 'p'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public'
        AND i.relname = 'analytics_cache_user_id_days_uidx'
    ) THEN
      ALTER TABLE public.analytics_cache
        ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY USING INDEX analytics_cache_user_id_days_uidx;
    ELSE
      ALTER TABLE public.analytics_cache
        ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL
        OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 100))
  LOOP
    BEGIN
      v_data := public._compute_analytics_summary(v_user.user_id, 7);
      INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
      VALUES (v_user.user_id, 7, v_data, now())
      ON CONFLICT (user_id, days) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id,
          'state', SQLSTATE,
          'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed', v_count,
    'failed', v_failed,
    'errors', v_errors,
    'limit', GREATEST(1, LEAST(COALESCE(_limit, 20), 100)),
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END
$function$;

REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;