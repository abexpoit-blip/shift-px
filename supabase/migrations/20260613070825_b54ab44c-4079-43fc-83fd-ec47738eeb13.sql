
-- 1. Admin: 14-day clicks time-series
CREATE OR REPLACE FUNCTION public.admin_clicks_timeseries(_days int DEFAULT 14)
RETURNS TABLE(date text, total bigint, ours bigint, offer bigint, bots bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT to_char((CURRENT_DATE - i), 'YYYY-MM-DD') AS d
    FROM generate_series(0, _days - 1) i
  ),
  agg AS (
    SELECT
      to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS d,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE routed_to = 'ours') AS ours,
      COUNT(*) FILTER (WHERE routed_to = 'offer') AS offer,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM clicks
    WHERE created_at >= (now() - (_days || ' days')::interval)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(agg.total, 0), COALESCE(agg.ours, 0),
         COALESCE(agg.offer, 0), COALESCE(agg.bots, 0)
  FROM days LEFT JOIN agg ON agg.d = days.d
  ORDER BY days.d ASC;
$$;

-- 2. Admin: top countries
CREATE OR REPLACE FUNCTION public.admin_top_countries(_days int DEFAULT 7, _limit int DEFAULT 12)
RETURNS TABLE(country text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(country, ''), '??') AS country, COUNT(*)::bigint AS count
  FROM clicks
  WHERE created_at >= (now() - (_days || ' days')::interval)
  GROUP BY 1
  ORDER BY count DESC
  LIMIT _limit;
$$;

-- 3. Admin: per-user 7-day trend
CREATE OR REPLACE FUNCTION public.admin_user_trend(_user_id uuid, _days int DEFAULT 7)
RETURNS TABLE(date text, clicks bigint, bots bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH link_ids AS (
    SELECT id FROM links WHERE user_id = _user_id
  ),
  days AS (
    SELECT to_char((CURRENT_DATE - i), 'YYYY-MM-DD') AS d
    FROM generate_series(0, _days - 1) i
  ),
  agg AS (
    SELECT
      to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS d,
      COUNT(*) AS clicks,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM clicks
    WHERE link_id IN (SELECT id FROM link_ids)
      AND created_at >= (now() - (_days || ' days')::interval)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(agg.clicks, 0), COALESCE(agg.bots, 0)
  FROM days LEFT JOIN agg ON agg.d = days.d
  ORDER BY days.d ASC;
$$;

-- 4. Admin: bot reasons grouped by prefix (24h)
CREATE OR REPLACE FUNCTION public.admin_bot_reasons(_hours int DEFAULT 24, _limit int DEFAULT 6)
RETURNS TABLE(key text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS key,
         COUNT(*)::bigint AS count
  FROM clicks
  WHERE is_bot = true
    AND created_at >= (now() - (_hours || ' hours')::interval)
  GROUP BY 1
  ORDER BY count DESC
  LIMIT _limit;
$$;

-- 5. Admin: count of FB-prefixed bot reasons (for fbCrawlerBlocked KPI)
CREATE OR REPLACE FUNCTION public.admin_fb_blocked_count(_hours int DEFAULT 24)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM clicks
  WHERE is_bot = true
    AND created_at >= (now() - (_hours || ' hours')::interval)
    AND COALESCE(bot_reason, '') LIKE 'fb-%';
$$;

-- 6. User cohort retention (30 days, computed fully in SQL)
CREATE OR REPLACE FUNCTION public.get_cohort_retention(_user_id uuid)
RETURNS TABLE(day_label text, day_idx int, size bigint, d1 bigint, d7 bigint, d30 bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM links WHERE user_id = _user_id;
  IF v_link_ids IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visits AS (
    SELECT DISTINCT ip,
           ((created_at AT TIME ZONE 'UTC')::date - CURRENT_DATE) AS day_offset
    FROM clicks
    WHERE link_id = ANY(v_link_ids)
      AND is_bot = false
      AND ip IS NOT NULL
      AND created_at >= (now() - interval '60 days')
  ),
  first_seen AS (
    SELECT ip, MIN(day_offset) AS first_offset
    FROM visits
    GROUP BY ip
  ),
  -- cohort = users whose first visit was on this day (offset -13..0)
  cohort_days AS (
    SELECT generate_series(-13, 0) AS day_offset
  ),
  cohort_members AS (
    SELECT cd.day_offset, fs.ip
    FROM cohort_days cd
    JOIN first_seen fs ON fs.first_offset = cd.day_offset
  ),
  retained AS (
    SELECT cm.day_offset,
           COUNT(DISTINCT cm.ip) AS size,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip AND v.day_offset = cm.day_offset + 1
           )) AS d1,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip
               AND v.day_offset > cm.day_offset
               AND v.day_offset <= cm.day_offset + 7
           )) AS d7,
           COUNT(DISTINCT cm.ip) FILTER (WHERE EXISTS (
             SELECT 1 FROM visits v
             WHERE v.ip = cm.ip
               AND v.day_offset > cm.day_offset
               AND v.day_offset <= cm.day_offset + 30
           )) AS d30
    FROM cohort_members cm
    GROUP BY cm.day_offset
  )
  SELECT
    to_char(CURRENT_DATE + cd.day_offset, 'Mon DD') AS day_label,
    cd.day_offset AS day_idx,
    COALESCE(r.size, 0)::bigint,
    COALESCE(r.d1, 0)::bigint,
    COALESCE(r.d7, 0)::bigint,
    COALESCE(r.d30, 0)::bigint
  FROM cohort_days cd
  LEFT JOIN retained r ON r.day_offset = cd.day_offset
  ORDER BY cd.day_offset ASC;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.admin_clicks_timeseries(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_trend(uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cohort_retention(uuid) TO authenticated, service_role;

-- Helpful indexes (create if missing) for fast aggregation
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON public.clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_link_created ON public.clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_isbot_created ON public.clicks (is_bot, created_at DESC);
