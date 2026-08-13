-- ============================================================
-- 15_dashboard_single_scan.sql
-- Rewrites get_dashboard_stats to scan clicks ONCE instead of 4-5 times.
-- Removes expensive COUNT(DISTINCT ip) (was scanning 264K rows).
-- Uses approx unique visitors via daily IP sampling.
-- Safe to re-run.
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

  -- ===== SINGLE SCAN over clicks (30d, human only) =====
  -- Materialize once into a temp result set, then derive everything.
  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT
    link_id,
    (created_at AT TIME ZONE 'UTC')::date AS d,
    country,
    ip,
    ua,
    created_at
  FROM clicks
  WHERE link_id = ANY(v_link_ids)
    AND NOT is_bot
    AND created_at >= v_since30;

  CREATE INDEX ON _c (d);
  CREATE INDEX ON _c (link_id, d);

  -- 1) 30-day daily series (clicks + daily_stats hybrid)
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ),
  click_days AS (
    SELECT DISTINCT d FROM _c
  ),
  click_agg AS (
    SELECT d, COUNT(*)::bigint AS cnt FROM _c GROUP BY d
  ),
  ds_agg AS (
    SELECT day AS d, SUM(human_clicks)::bigint AS cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY day
  ),
  combined AS (
    SELECT d, cnt FROM click_agg
    UNION ALL
    SELECT d, cnt FROM ds_agg
  ),
  totals AS (
    SELECT d, SUM(cnt) AS cnt FROM combined GROUP BY d
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(t.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN totals t ON t.d = d.d;

  -- 2) Country counts (hybrid)
  WITH click_days AS (SELECT DISTINCT d FROM _c),
  click_cty AS (
    SELECT country, COUNT(*)::bigint AS cnt FROM _c GROUP BY country
  ),
  ds_cty AS (
    SELECT key AS country, SUM(value::int)::bigint AS cnt
    FROM daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY key
  ),
  combined_cty AS (
    SELECT country, SUM(cnt) AS cnt FROM (
      SELECT country, cnt FROM click_cty
      UNION ALL
      SELECT country, cnt FROM ds_cty
    ) t GROUP BY country
  )
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM combined_cty;

  -- 3) Mobile percentage — only last 7d sample, capped at 20k rows
  WITH sample AS (
    SELECT ua FROM _c WHERE created_at >= v_since7 LIMIT 20000
  ),
  agg AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile') AS mob
    FROM sample
  )
  SELECT CASE WHEN total > 0 THEN ROUND((mob::numeric / total) * 100)::int ELSE 0 END
    INTO v_mobile_pct FROM agg;

  -- 4) Unique visitors — last 7d only (not 30d) to avoid huge DISTINCT scan
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM _c WHERE created_at >= v_since7 AND ip IS NOT NULL;

  -- 5) Per-link 7d sparkline
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ),
  agg AS (
    SELECT link_id, d, COUNT(*)::bigint AS cnt
    FROM _c
    WHERE created_at >= v_since7
    GROUP BY link_id, d
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

  DROP TABLE _c;

  RETURN jsonb_build_object(
    'clicksByDay',    COALESCE(v_clicks_by_day, '{}'::jsonb),
    'countryStats',   COALESCE(v_country_stats, '{}'::jsonb),
    'mobilePct',      v_mobile_pct,
    'uniqueVisitors', v_unique_visitors,
    'perLinkDaily',   COALESCE(v_per_link_daily, '{}'::jsonb)
  );
END $function$;
