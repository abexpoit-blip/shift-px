-- ============================================================
-- 17_dashboard_cache.sql
-- Per-user dashboard cache. Reads return instantly if cache
-- is < 2 minutes old. Heavy users no longer hammer the
-- clicks table on every page refresh.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_cache TO authenticated;
GRANT ALL ON public.dashboard_cache TO service_role;
ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own cache" ON public.dashboard_cache;
CREATE POLICY "users read own cache"
  ON public.dashboard_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Internal compute function (the old heavy logic, unchanged)
CREATE OR REPLACE FUNCTION public._compute_dashboard_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  WITH c30 AS MATERIALIZED (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, country, ip, ua, created_at
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
  ),
  by_day AS (SELECT d, COUNT(*)::bigint AS cnt FROM c30 GROUP BY d),
  by_country AS (SELECT country, COUNT(*)::bigint AS cnt FROM c30 GROUP BY country),
  click_days AS (SELECT DISTINCT d FROM c30),
  ds_day AS (
    SELECT day AS d, SUM(human_clicks)::bigint AS cnt FROM daily_stats
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY day
  ),
  ds_cty AS (
    SELECT key AS country, SUM(value::int)::bigint AS cnt
    FROM daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT d FROM click_days)
    GROUP BY key
  ),
  days_grid AS (SELECT (now()::date - i) AS d FROM generate_series(0, 29) i),
  combined_day AS (
    SELECT d, SUM(cnt) AS cnt FROM (
      SELECT d, cnt FROM by_day UNION ALL SELECT d, cnt FROM ds_day
    ) t GROUP BY d
  ),
  combined_cty AS (
    SELECT country, SUM(cnt) AS cnt FROM (
      SELECT country, cnt FROM by_country UNION ALL SELECT country, cnt FROM ds_cty
    ) t GROUP BY country
  )
  SELECT
    (SELECT jsonb_object_agg(to_char(g.d, 'YYYY-MM-DD'), COALESCE(cd.cnt, 0))
       FROM days_grid g LEFT JOIN combined_day cd ON cd.d = g.d),
    (SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt) FROM combined_cty)
  INTO v_clicks_by_day, v_country_stats;


  -- Mobile %
  WITH sample AS (
    SELECT ua FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since7
    LIMIT 20000
  )
  SELECT CASE WHEN COUNT(*) > 0
              THEN ROUND((COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')::numeric / COUNT(*)) * 100)::int
              ELSE 0 END
    INTO v_mobile_pct FROM sample;

  -- Unique visitors 7d
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND ip IS NOT NULL AND created_at >= v_since7;

  -- Per-link 7d sparkline
  WITH days AS (SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i),
  agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::bigint AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since7
    GROUP BY 1, 2
  ),
  per_link AS (
    SELECT l_id, jsonb_agg(COALESCE(a.cnt, 0) ORDER BY d.idx) AS arr
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

-- Public RPC: cache-first wrapper
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_payload jsonb;
  v_updated timestamptz;
  v_ttl interval := interval '2 minutes';
BEGIN
  SELECT payload, updated_at INTO v_payload, v_updated
  FROM dashboard_cache WHERE user_id = _user_id;

  IF v_payload IS NOT NULL AND v_updated > now() - v_ttl THEN
    RETURN v_payload;
  END IF;

  v_payload := public._compute_dashboard_stats(_user_id);

  INSERT INTO dashboard_cache (user_id, payload, updated_at)
  VALUES (_user_id, v_payload, now())
  ON CONFLICT (user_id) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at;

  RETURN v_payload;
END $function$;
