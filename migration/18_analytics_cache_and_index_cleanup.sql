-- =============================================================================
-- Migration 18: Analytics cache (kill /analytics 60s timeouts)
--               + drop redundant clicks indexes (speed up redirect INSERT)
-- =============================================================================
-- Problems addressed:
--   1) get_analytics_summary mean 3.28s, called from /analytics page → 60s
--      nginx timeout → 504 → "super slow laggy" UX. No caching today.
--   2) clicks table has 20 indexes; several are exact duplicates or strict
--      subsets. Every INSERT updates ALL of them. Under 1500+ clicks/min
--      this serializes the redirect path and produces "upstream prematurely
--      closed connection" / "connection reset" → Facebook ad rejects.
--
-- This migration is hot-applicable. No app deploy required.
-- =============================================================================

-- Allow long-running maintenance (index drops are fast but be safe)
SET statement_timeout = 0;
SET lock_timeout = '30s';

-- -----------------------------------------------------------------------------
-- PART A: Per-user analytics cache (2 min TTL, same pattern as dashboard_cache)
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
-- PART B: Rename existing heavy function to _compute_analytics_summary
--         and replace get_analytics_summary with a cached wrapper.
-- -----------------------------------------------------------------------------

-- Move the current implementation into a private compute function.
-- (We re-create it verbatim under a new name so the body is unchanged.)
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
  v_browsers jsonb;
  v_live jsonb;
BEGIN
  SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
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

  -- Countries (capped sample)
  SELECT jsonb_agg(jsonb_build_object(
           'code', country,
           'humans', COUNT(*) FILTER (WHERE NOT is_bot),
           'bots',   COUNT(*) FILTER (WHERE is_bot)))
    INTO v_countries
  FROM (
    SELECT country, is_bot
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    LIMIT 50000
  ) AS c
  GROUP BY country
  ORDER BY COUNT(*) DESC
  LIMIT 20;

  -- Browsers (top 10)
  SELECT jsonb_agg(jsonb_build_object('name', name, 'cnt', cnt)) INTO v_browsers
  FROM (
    SELECT ua AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY ua
    LIMIT 10
  ) b;

  -- Live events (last 20)
  SELECT jsonb_agg(t) INTO v_live
  FROM (
    SELECT id, link_id, country, ua, is_bot, routed_to, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'last24h', v_last24,
    'last24hHumans', v_last24_humans,
    'last60s', v_last60s,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly',     COALESCE(v_hourly, '[]'::jsonb),
    'heatmap',    COALESCE(v_heatmap, '[]'::jsonb),
    'heatMax',    COALESCE(v_heatmax, 0),
    'countries',  COALESCE(v_countries, '[]'::jsonb),
    'browsers',   COALESCE(v_browsers, '[]'::jsonb),
    'liveEvents', COALESCE(v_live, '[]'::jsonb)
  );
END;
$function$;

-- Cached wrapper — keeps the public API the same, but answers from
-- analytics_cache when fresh (<2 min). First call per user every 2 min
-- pays the cost; the rest return instantly. Live counters (last60s) are
-- slightly stale by up to 2 minutes — acceptable for the analytics page.
CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
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

GRANT EXECUTE ON FUNCTION public._compute_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(uuid, integer)      TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- PART C: Drop redundant indexes on public.clicks
--         (each dropped index = faster INSERT on redirect hot path)
-- -----------------------------------------------------------------------------
-- Kept (canonical):
--   idx_clicks_link_created_bot   (link_id, created_at DESC, is_bot)
--   idx_clicks_link_isbot_created (link_id, is_bot, created_at DESC)
--   idx_clicks_isbot_created      (is_bot, created_at DESC)
--   idx_clicks_link_ip_created    (link_id, ip, created_at DESC) WHERE is_bot=false AND ip IS NOT NULL
--   idx_clicks_created_at, idx_clicks_country, clicks_pkey, etc.
--
-- Dropped (exact duplicates / strict subsets):

DROP INDEX IF EXISTS public.clicks_link_id_created_at_idx;   -- == idx_clicks_link_created (and subset of *_bot)
DROP INDEX IF EXISTS public.idx_clicks_link_created;          -- subset of idx_clicks_link_created_bot
DROP INDEX IF EXISTS public.idx_clicks_is_bot_created_at;     -- exact dup of idx_clicks_isbot_created
DROP INDEX IF EXISTS public.idx_clicks_link_ip_human;         -- strict subset of idx_clicks_link_ip_created

-- -----------------------------------------------------------------------------
-- PART D: Reload PostgREST schema cache so the renamed cached fn is picked up
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
SELECT 'analytics_cache table' AS check, to_regclass('public.analytics_cache') IS NOT NULL AS ok
UNION ALL
SELECT 'get_analytics_summary fn', to_regprocedure('public.get_analytics_summary(uuid,integer)') IS NOT NULL
UNION ALL
SELECT '_compute_analytics_summary fn', to_regprocedure('public._compute_analytics_summary(uuid,integer)') IS NOT NULL;

SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='clicks'
ORDER BY indexname;
