-- =============================================================================
-- Migration 22: Restore FULL analytics compute + cached wrapper.
--
-- Bug being fixed (live prod):
--   The current public.get_analytics_summary on the VPS only returns
--   { links, total, humans, bots, hourly, heatmap, countries, browsers (raw),
--     liveEvents } — and does NOT use analytics_cache.
--
--   Result: the analytics page is missing Devices, Operating Systems,
--   Top Performing Links, Bot Reasons, Traffic Sources, and the browsers
--   list is grouped by the raw UA string (looks broken). Every page load
--   recomputes from scratch (10-20s) because the cache is bypassed.
--
-- This migration:
--   1. Re-creates analytics_cache if missing (idempotent).
--   2. Installs a FULL _compute_analytics_summary that emits every field
--      the frontend expects: devices, operatingSystems, browsers (parsed
--      via ua_browser), botReasons, trafficSources, topLinks, plus all
--      pre-existing fields.
--   3. Replaces get_analytics_summary with a 5-minute cached wrapper.
--   4. TRUNCATEs analytics_cache so any stale broken payloads are dropped.
--   5. Reloads PostgREST schema.
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = '30s';

-- -----------------------------------------------------------------------------
-- PART A: Cache table (idempotent)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  user_id    uuid PRIMARY KEY,
  days       integer NOT NULL,
  payload    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.analytics_cache TO authenticated;
GRANT ALL    ON public.analytics_cache TO service_role;

ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own analytics cache" ON public.analytics_cache;
CREATE POLICY "Users view own analytics cache"
  ON public.analytics_cache FOR SELECT
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- PART B: Full compute function (with devices, OS, top links, traffic sources,
--         bot reasons, parsed browsers)
-- -----------------------------------------------------------------------------
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

  -- Time-bounded KPIs (single scan of recent clicks)
  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
    COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
  INTO v_last24, v_last24_humans, v_last60s
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

  -- Persistent totals from links table (accurate across purges)
  SELECT
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_humans, v_bots, v_ours, v_offers
  FROM links
  WHERE user_id = _user_id;

  v_total := v_humans + v_bots;

  -- 24h hourly series (humans)
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

  -- 7d x 24h heatmap
  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  )
  SELECT jsonb_agg(
    (SELECT jsonb_agg(COALESCE((SELECT cnt FROM click_agg WHERE day_idx = d AND hour_utc = h), 0))
     FROM generate_series(0, 23) h)
  ), MAX(cnt)
  INTO v_heatmap, v_heatmax
  FROM click_agg;

  -- Countries
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

  -- Devices (humans only)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  -- Browsers (parsed, humans only)
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

  -- Operating Systems (humans only)
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

  -- Bot reason breakdown
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

  -- Traffic sources
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

  -- Top links (within window)
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

  -- Live events (last 20)
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
END;
$function$;

-- -----------------------------------------------------------------------------
-- PART C: Cached wrapper (5 min TTL — was 2 min, raised for fewer cache misses)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid);

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
  v_ttl interval := interval '5 minutes';
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

GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer)      TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- PART D: Flush stale cache entries (old broken payloads) and reload schema
-- -----------------------------------------------------------------------------
TRUNCATE public.analytics_cache;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
SELECT
  proname,
  CASE WHEN prosrc LIKE '%v_devices%'
        AND prosrc LIKE '%v_top_links%'
        AND prosrc LIKE '%v_sources%'
        AND prosrc LIKE '%ua_browser%'
       THEN 'FULL ✓' ELSE 'STILL STRIPPED ✗' END AS compute_status
FROM pg_proc WHERE proname = '_compute_analytics_summary';

SELECT
  proname,
  CASE WHEN prosrc LIKE '%analytics_cache%' THEN 'CACHED ✓' ELSE 'NOT CACHED ✗' END AS wrapper_status
FROM pg_proc WHERE proname = 'get_analytics_summary';
