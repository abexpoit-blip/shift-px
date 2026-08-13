CREATE OR REPLACE FUNCTION public._compute_analytics_summary(_user_id uuid, _days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_since timestamptz := now() - (_days || ' days')::interval;
  v_link_ids uuid[];
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
  v_heatmax bigint;
  v_countries jsonb;
  v_devices jsonb;
  v_browsers jsonb;
  v_os jsonb;
  v_reasons jsonb;
  v_sources jsonb;
  v_top_links jsonb;
  v_live jsonb;
BEGIN
  SELECT array_agg(id),
         jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  SELECT
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_humans, v_bots, v_ours, v_offers
  FROM links
  WHERE user_id = _user_id;

  v_total := v_humans + v_bots;

  WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
  counts AS (
    SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
           COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at > now() - interval '24 hours'
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
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
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

  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT
      UPPER(COALESCE(country, '??')) AS code,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_browsers
  FROM (
    SELECT ua_browser(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_os
  FROM (
    SELECT ua_os(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_reasons
  FROM (
    SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND is_bot
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_sources
  FROM (
    SELECT
      referrer_source(referer_host) AS key,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1
    ORDER BY humans DESC
    LIMIT 8
  ) t;

  SELECT jsonb_agg(t ORDER BY t.humans DESC)
    INTO v_top_links
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
      COUNT(*) FILTER (WHERE is_bot) AS bots,
      COUNT(*) AS total
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY link_id
    ORDER BY humans DESC
    LIMIT 6
  ) t;

  SELECT jsonb_agg(t ORDER BY t.created_at DESC) INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links',            COALESCE(v_links, '[]'::jsonb),
    'total',            v_total,
    'humans',           v_humans,
    'bots',             v_bots,
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
    'liveEvents',       COALESCE(v_live, '[]'::jsonb)
  );
END
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'analytics_cache') THEN
    EXECUTE 'TRUNCATE TABLE public.analytics_cache';
  END IF;
END $$;