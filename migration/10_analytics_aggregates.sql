-- =====================================================================
-- 10_analytics_aggregates.sql — Server-side aggregation RPCs
-- Fixes high-traffic truncation: previous code fetched up to 50k raw
-- click rows then aggregated in JS. With 50L+/day traffic that means
-- charts only reflected the last ~33 hours of data, while old data was
-- silently dropped. These RPCs do all GROUP BY work in Postgres and
-- return a single compact JSONB, so accuracy is independent of volume.
--
-- Apply on self-hosted Supabase:
--   docker exec -i supabase-db psql -U postgres -d postgres -f - < migration/10_analytics_aggregates.sql
-- =====================================================================

-- Performance: critical composite index for the (link_id, created_at) scan
CREATE INDEX IF NOT EXISTS idx_clicks_link_created ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_created_bot ON public.clicks (created_at DESC, is_bot);

-- ---------------------------------------------------------------------
-- Helper: classify UA -> device / browser / os family in pure SQL
-- Mirrors the JS logic in analytics.functions.ts so results stay identical.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ua_device(_ua text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN 'Other'
    WHEN _ua ~* '(ipad|tablet|playbook|silk)' THEN 'Tablet'
    WHEN _ua ~* '(mobi|android|iphone|ipod|phone|webos)' THEN 'Mobile'
    WHEN _ua ~* '(windows|macintosh|linux|x11|cros)' THEN 'Desktop'
    ELSE 'Other'
  END
$$;

CREATE OR REPLACE FUNCTION public.ua_os(_ua text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN 'Unknown'
    WHEN _ua ~* '(iphone|ipad|ipod)' THEN 'iOS'
    WHEN _ua ~* 'android' THEN 'Android'
    WHEN _ua ~* 'windows nt' THEN 'Windows'
    WHEN _ua ~* '(mac os x|macintosh)' THEN 'macOS'
    WHEN _ua ~* 'cros' THEN 'ChromeOS'
    WHEN _ua ~* '(linux|x11)' THEN 'Linux'
    ELSE 'Other'
  END
$$;

CREATE OR REPLACE FUNCTION public.ua_browser(_ua text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _ua IS NULL OR _ua = '' THEN 'Unknown'
    WHEN _ua ~* 'edg/' THEN 'Edge'
    WHEN _ua ~* '(opr/|opera)' THEN 'Opera'
    WHEN _ua ~* 'samsungbrowser' THEN 'Samsung Internet'
    WHEN _ua ~* 'ucbrowser' THEN 'UC Browser'
    WHEN _ua ~* 'brave' THEN 'Brave'
    WHEN _ua ~* 'firefox' THEN 'Firefox'
    WHEN _ua ~* '(fban|fbav)' THEN 'Facebook App'
    WHEN _ua ~* 'instagram' THEN 'Instagram App'
    WHEN _ua ~* 'chrome' THEN 'Chrome'
    WHEN _ua ~* 'safari' THEN 'Safari'
    ELSE 'Other'
  END
$$;

CREATE OR REPLACE FUNCTION public.referrer_source(_host text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _host IS NULL OR _host = '' THEN 'direct'
    WHEN _host ~* '(facebook|fb\.)' THEN 'facebook'
    WHEN _host ~* 'instagram' THEN 'instagram'
    WHEN _host ~* 'tiktok' THEN 'tiktok'
    WHEN _host ~* '(twitter|x\.com)' THEN 'twitter'
    WHEN _host ~* 'youtube' THEN 'youtube'
    WHEN _host ~* 'google' THEN 'google'
    WHEN _host ~* 'bing' THEN 'bing'
    WHEN _host ~* 'reddit' THEN 'reddit'
    WHEN _host ~* '(telegram|t\.me)' THEN 'telegram'
    WHEN _host ~* 'whatsapp' THEN 'whatsapp'
    ELSE 'other'
  END
$$;

-- ---------------------------------------------------------------------
-- Main analytics RPC — replaces raw fetch in getAnalyticsData
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
  -- 1. Resolve owned link ids
  SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  -- 2. KPI scan (single pass over the window)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_bot),
    COUNT(*) FILTER (WHERE is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds'),
    COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'offer'),
    COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'ours')
  INTO v_total, v_humans, v_bots, v_last24, v_last24_humans, v_last60s, v_offers, v_ours
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  -- 3. 24h hourly series (humans only)
  WITH buckets AS (
    SELECT generate_series(0, 23) AS bucket
  ), counts AS (
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

  -- 4. 7d x 24h heatmap
  WITH agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  )
  SELECT
    jsonb_agg(row ORDER BY d),
    COALESCE(MAX(maxv), 1)
  INTO v_heatmap, v_heatmax
  FROM (
    SELECT d.d,
           jsonb_agg(COALESCE(a.cnt, 0) ORDER BY h.h) AS row,
           MAX(COALESCE(a.cnt, 0)) AS maxv
    FROM generate_series(0, 6) d(d)
    CROSS JOIN generate_series(0, 23) h(h)
    LEFT JOIN agg a ON a.day_idx = d.d AND a.hour_utc = h.h
    GROUP BY d.d
  ) t;

  -- 5. Top countries (humans + bots)
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
    LIMIT 10
  ) t;

  -- 6. Devices (humans)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  -- 7. Browsers (humans)
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

  -- 8. Operating systems (humans)
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

  -- 9. Bot reason breakdown
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

  -- 10. Traffic sources
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

  -- 11. Top links (within window)
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

  -- 12. Live events — last 20 raw rows (small, no truncation issue)
  SELECT jsonb_agg(t ORDER BY t.created_at DESC)
    INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links',          COALESCE(v_links, '[]'::jsonb),
    'total',          v_total,
    'humans',         v_humans,
    'bots',           v_bots,
    'last24h',        v_last24,
    'last24hHumans',  v_last24_humans,
    'last60s',        v_last60s,
    'offers',         v_offers,
    'oursClicks',     v_ours,
    'hourly',         COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',        COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',        v_heatmax,
    'countries',      COALESCE(v_countries, '[]'::jsonb),
    'devices',        COALESCE(v_devices, '[]'::jsonb),
    'browsers',       COALESCE(v_browsers, '[]'::jsonb),
    'operatingSystems', COALESCE(v_os, '[]'::jsonb),
    'botReasons',     COALESCE(v_reasons, '[]'::jsonb),
    'trafficSources', COALESCE(v_sources, '[]'::jsonb),
    'topLinks',       COALESCE(v_top_links, '[]'::jsonb),
    'liveEvents',     COALESCE(v_live, '[]'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Dashboard stats RPC — replaces raw fetch in getDashboardData
-- Returns: clicksByDay (30d humans), countryStats, mobilePct,
-- uniqueVisitors, perLinkDaily (7d humans).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
  v_since7  timestamptz := now() - interval '7 days';
  v_clicks_by_day jsonb;
  v_country_stats jsonb;
  v_mobile_pct int := 0;
  v_unique_visitors bigint := 0;
  v_per_link_daily jsonb;
  v_mobile_total bigint;
  v_mobile_count bigint;
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'clicksByDay', '{}'::jsonb,
      'countryStats', '{}'::jsonb,
      'mobilePct', 0,
      'uniqueVisitors', 0,
      'perLinkDaily', '{}'::jsonb
    );
  END IF;

  -- 30-day daily series (humans only) — always emit all 30 day keys
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ), agg AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY 1
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(a.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN agg a ON a.d = d.d;

  -- Country counts (humans, 30d)
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM (
    SELECT country, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY country
  ) t;

  -- Mobile percentage (humans, 30d)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')
  INTO v_mobile_total, v_mobile_count
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30;

  IF v_mobile_total > 0 THEN
    v_mobile_pct := ROUND((v_mobile_count::numeric / v_mobile_total::numeric) * 100)::int;
  END IF;

  -- Unique visitors (distinct IP, humans, 30d)
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30 AND ip IS NOT NULL;

  -- Per-link 7-day sparkline (humans)
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ), agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since7
    GROUP BY 1, 2
  ), per_link AS (
    SELECT
      l_id,
      jsonb_agg(COALESCE(a.cnt, 0) ORDER BY d.idx) AS arr
    FROM unnest(v_link_ids) l_id
    CROSS JOIN days d
    LEFT JOIN agg a ON a.link_id = l_id AND a.d = d.d
    GROUP BY l_id
  )
  SELECT jsonb_object_agg(l_id::text, arr) INTO v_per_link_daily FROM per_link;

  RETURN jsonb_build_object(
    'clicksByDay',    COALESCE(v_clicks_by_day, '{}'::jsonb),
    'countryStats',   COALESCE(v_country_stats, '{}'::jsonb),
    'mobilePct',      v_mobile_pct,
    'uniqueVisitors', v_unique_visitors,
    'perLinkDaily',   COALESCE(v_per_link_daily, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated, service_role;
