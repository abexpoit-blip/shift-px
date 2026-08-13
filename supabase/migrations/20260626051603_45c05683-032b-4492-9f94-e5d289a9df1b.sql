
CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
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
  v_sample_limit integer := 5000;
  v_per_link_limit integer := 1500;
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

  -- ACCURATE live counters: compute directly from clicks (not sample)
  SELECT
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '24 hours' AND NOT c.is_bot),
    COUNT(*) FILTER (WHERE c.created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM public.links l
  JOIN public.clicks c ON c.link_id = l.id
  WHERE l.user_id = _user_id
    AND c.created_at > now() - interval '24 hours';

  -- ACCURATE unique visitor count from raw clicks
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

  -- Sample for heavy aggregations only (devices/browsers/countries/etc)
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

  -- ACCURATE live feed: latest 20 events directly from raw clicks
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_live
  FROM (
    SELECT c.id, c.link_id, c.country, c.ua, c.is_bot, c.routed_to, c.created_at
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    WHERE l.user_id = _user_id
      AND c.created_at > now() - interval '2 hours'
    ORDER BY c.created_at DESC
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

-- Reduce cron batch size from 20 → 10 (smoother DB load)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-analytics-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(10); $$
);
