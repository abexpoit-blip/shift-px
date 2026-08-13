-- ============================================================
-- 16_dashboard_materialized_cte.sql
-- Fix: STABLE function cannot CREATE TEMP TABLE (caused HTTP 400).
-- Use a single MATERIALIZED CTE so Postgres scans clicks once
-- and reuses the result for all aggregations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
  v_since7  timestamptz := now() - interval '7 days';
  v_clicks_by_day jsonb;
  v_country_stats jsonb;
  v_mobile_pct int := 0;
  v_unique_visitors bigint := 0;
  v_per_link_daily jsonb;
  v_click_days date[];
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

  -- ===== 1) Daily series + country counts in ONE scan (30d) =====
  WITH c30 AS MATERIALIZED (
    SELECT
      link_id,
      (created_at AT TIME ZONE 'UTC')::date AS d,
      country
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at >= v_since30
  ),
  by_day AS (
    SELECT d, COUNT(*)::bigint AS cnt FROM c30 GROUP BY d
  ),
  by_country AS (
    SELECT country, COUNT(*)::bigint AS cnt FROM c30 GROUP BY country
  ),
  click_days AS (
    SELECT DISTINCT d FROM c30
  ),
  ds_day AS (
    SELECT day AS d, SUM(human_clicks)::bigint AS cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY day
  ),
  ds_cty AS (
    SELECT key AS country, SUM(value::int)::bigint AS cnt
    FROM daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY key
  ),
  days_grid AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ),
  combined_day AS (
    SELECT d, SUM(cnt) AS cnt FROM (
      SELECT d, cnt FROM by_day
      UNION ALL
      SELECT d, cnt FROM ds_day
    ) t GROUP BY d
  ),
  combined_cty AS (
    SELECT country, SUM(cnt) AS cnt FROM (
      SELECT country, cnt FROM by_country
      UNION ALL
      SELECT country, cnt FROM ds_cty
    ) t GROUP BY country
  )
  SELECT
    (SELECT jsonb_object_agg(to_char(g.d, 'YYYY-MM-DD'), COALESCE(cd.cnt, 0))
       FROM days_grid g LEFT JOIN combined_day cd ON cd.d = g.d),
    (SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt) FROM combined_cty)
  INTO v_clicks_by_day, v_country_stats;

  -- ===== 2) Mobile % — last 7d sample, 20k row cap =====
  WITH sample AS (
    SELECT ua FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at >= v_since7
    LIMIT 20000
  )
  SELECT CASE WHEN COUNT(*) > 0
              THEN ROUND((COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')::numeric
                          / COUNT(*)) * 100)::int
              ELSE 0 END
    INTO v_mobile_pct FROM sample;

  -- ===== 3) Unique visitors — 7d only =====
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM clicks
  WHERE link_id = ANY(v_link_ids)
    AND NOT is_bot
    AND ip IS NOT NULL
    AND created_at >= v_since7;

  -- ===== 4) Per-link 7d sparkline =====
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ),
  agg AS (
    SELECT link_id,
           (created_at AT TIME ZONE 'UTC')::date AS d,
           COUNT(*)::bigint AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot
      AND created_at >= v_since7
    GROUP BY 1, 2
  ),
  per_link AS (
    SELECT l_id,
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
END $function$;
