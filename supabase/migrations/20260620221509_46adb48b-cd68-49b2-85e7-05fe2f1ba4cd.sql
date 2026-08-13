-- Fix analytics Unique Visitors + cache conflict/read-only issues.

ALTER TABLE public.analytics_cache
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.analytics_cache SET days = 7 WHERE days IS NULL;
DELETE FROM public.analytics_cache WHERE user_id IS NULL OR days IS NULL;

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
BEGIN
  SELECT conname INTO v_pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.analytics_cache'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF v_pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.analytics_cache DROP CONSTRAINT %I', v_pk_name);
  END IF;
END $$;

ALTER TABLE public.analytics_cache
  ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (user_id, days);

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL ON public.analytics_cache TO service_role;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_updated_at
  ON public.analytics_cache (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clicks_link_ip_human_created
  ON public.clicks (link_id, ip, created_at DESC)
  WHERE is_bot = false AND ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT
      id AS link_id,
      COALESCE(clicks_count, 0)::bigint AS humans,
      COALESCE(bot_clicks_count, 0)::bigint AS bots,
      (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'uniqueVisitors',   v_unique,
    'unique_ips',       v_unique,
    'last24h',          0,
    'last24hHumans',    0,
    'last60s',          0,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
    'heatmap',          jsonb_build_array(
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
                          jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
                        ),
    'heatMax',          1,
    'countries',        '[]'::jsonb,
    'devices',          '[]'::jsonb,
    'browsers',         '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons',       '[]'::jsonb,
    'trafficSources',   '[]'::jsonb,
    'topLinks',         v_top_links,
    'liveEvents',       '[]'::jsonb,
    '_fallback',        true
  );
END
$function$;

CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_hourly jsonb;
  v_heatmap jsonb;
  v_heatmax bigint := 0;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
  v_unique bigint := 0;
  v_sample_limit integer := 20000;
  v_per_link_limit integer := 5000;
  v_sampled bigint := 0;
BEGIN
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  v_total := v_humans + v_bots;

  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT s.*
  FROM (
    SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
    FROM public.links l
    JOIN LATERAL (
      SELECT c.link_id, c.created_at, c.is_bot, c.country, c.ua, c.bot_reason, c.referer_host, c.routed_to, c.id, c.ip
      FROM public.clicks c
      WHERE c.link_id = l.id
        AND c.created_at >= v_since
      ORDER BY c.created_at DESC
      LIMIT v_per_link_limit
    ) c ON true
    WHERE l.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT v_sample_limit
  ) s;

  SELECT COUNT(*) INTO v_sampled FROM _c;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM _c;

  BEGIN
    SELECT COUNT(DISTINCT c.ip) INTO v_unique
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at >= v_since
      AND c.is_bot = false
      AND c.ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    SELECT COUNT(DISTINCT ip) INTO v_unique
    FROM _c
    WHERE NOT is_bot AND ip IS NOT NULL;
  END;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM _c
    WHERE NOT is_bot AND created_at > now() - interval '24 hours'
    GROUP BY 1
  )
  SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
    INTO v_hourly
  FROM buckets b
  LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);

  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM _c
    GROUP BY 1, 2
  ),
  grid AS (
    SELECT d_day, h_hour, COALESCE(ca.cnt, 0)::bigint AS cnt
    FROM generate_series(0, 6) AS d_day
    CROSS JOIN generate_series(0, 23) AS h_hour
    LEFT JOIN click_agg ca ON ca.day_idx = d_day AND ca.hour_utc = h_hour
  ),
  rows_agg AS (
    SELECT d_day, jsonb_agg(cnt ORDER BY h_hour) AS row_arr
    FROM grid
    GROUP BY d_day
  )
  SELECT
    COALESCE(jsonb_agg(row_arr ORDER BY d_day), '[]'::jsonb),
    COALESCE((SELECT MAX(cnt) FROM click_agg), 0)
  INTO v_heatmap, v_heatmax
  FROM rows_agg;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(country, '??')) AS code,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_devices
  FROM (SELECT ua_device(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_browsers
  FROM (SELECT ua_browser(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 8) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_os
  FROM (SELECT ua_os(ua) AS name, COUNT(*) AS cnt FROM _c WHERE NOT is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_reasons
  FROM (SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt FROM _c WHERE is_bot GROUP BY 1 ORDER BY cnt DESC LIMIT 6) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
    INTO v_sources
  FROM (
    SELECT referrer_source(referer_host) AS key,
           COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
           COUNT(*) FILTER (WHERE is_bot) AS bots,
           COUNT(*) AS total
    FROM _c
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM _c
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'links',            v_links,
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
    'unique',           v_unique,
    'uniqueVisitors',   v_unique,
    'unique_ips',       v_unique,
    'last24h',          v_last24,
    'last24hHumans',    v_last24_humans,
    'last60s',          v_last60s,
    'offers',           v_offers,
    'oursClicks',       v_ours,
    'hourly',           COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',          COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',          COALESCE(v_heatmax, 0),
    'countries',        COALESCE(v_countries, '[]'::jsonb),
    'devices',          COALESCE(v_devices, '[]'::jsonb),
    'browsers',         COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',       COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources',   COALESCE(v_sources, '[]'::jsonb),
    'topLinks',         COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',       COALESCE(v_live, '[]'::jsonb),
    '_sampledClicks',   v_sampled,
    '_sampleLimit',     v_sample_limit
  );
END
$function$;

DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_data jsonb;
  v_updated timestamptz;
  v_unique bigint := 0;
BEGIN
  SELECT data, updated_at INTO v_data, v_updated
  FROM public.analytics_cache
  WHERE user_id = _user_id AND days = _days;

  IF v_data IS NOT NULL THEN
    v_unique := COALESCE(
      NULLIF(v_data->>'unique', '')::bigint,
      NULLIF(v_data->>'uniqueVisitors', '')::bigint,
      NULLIF(v_data->>'unique_ips', '')::bigint,
      0
    );

    RETURN v_data || jsonb_build_object(
      'unique', v_unique,
      'uniqueVisitors', v_unique,
      'unique_ips', v_unique,
      '_cached', true,
      '_cachedAt', v_updated,
      '_stale', v_updated < now() - interval '5 minutes'
    );
  END IF;

  RETURN public._fast_analytics_summary(_user_id, _days)
    || jsonb_build_object('_cached', false, '_cachedAt', NULL, '_stale', true, '_fallback', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
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
  PERFORM set_config('statement_timeout', '90s', true);
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

REVOKE ALL ON FUNCTION public._fast_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._compute_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_summary(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_active_analytics_cache(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO service_role;