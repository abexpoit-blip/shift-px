-- 1. Update get_analytics_summary to be Hybrid (Clicks + Daily Stats)
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
  
  v_hist_humans bigint := 0;
  v_hist_bots bigint := 0;
BEGIN
  -- 1. Resolve owned link ids
  SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
    INTO v_link_ids, v_links
  FROM links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('empty', true);
  END IF;

  -- 2. KPI scan (live clicks)
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

  -- Add historical totals from daily_stats (for data already purged from clicks)
  SELECT 
    COALESCE(SUM(human_clicks), 0),
    COALESCE(SUM(bot_clicks), 0)
  INTO v_hist_humans, v_hist_bots
  FROM daily_stats
  WHERE link_id = ANY(v_link_ids) AND day < (SELECT MIN(created_at)::date FROM clicks WHERE link_id = ANY(v_link_ids));
  
  -- But wait, the user wants "totals" to be forever. The 'links' table already has this!
  SELECT 
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0)
  INTO v_humans, v_bots
  FROM links
  WHERE user_id = _user_id;
  
  v_total := v_humans + v_bots;

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

  -- 4. 7d x 24h heatmap (Hybrid: Clicks + DailyStats)
  WITH click_agg AS (
    SELECT
      (6 - FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::int) AS day_idx,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
      COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
    GROUP BY 1, 2
  ), ds_agg AS (
    SELECT 
      (6 - (now()::date - day)) as day_idx,
      0 as hour_utc, -- daily_stats doesn't have hourly, we put it in bucket 0 or distribute? We'll put it in 0 for now as 'historical'
      SUM(human_clicks + bot_clicks) as cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids) AND day >= v_since::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined AS (
    SELECT day_idx, hour_utc, cnt FROM click_agg
    UNION ALL
    SELECT day_idx, hour_utc, cnt FROM ds_agg
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
    LEFT JOIN (SELECT day_idx, hour_utc, SUM(cnt) as cnt FROM combined GROUP BY 1, 2) a ON a.day_idx = d.d AND a.hour_utc = h.h
    GROUP BY d.d
  ) t;

  -- 5. Top countries (Hybrid: Clicks + DailyStats)
  WITH click_countries AS (
      SELECT
        UPPER(COALESCE(country, '??')) AS code,
        COUNT(*) FILTER (WHERE NOT is_bot) AS humans,
        COUNT(*) FILTER (WHERE is_bot) AS bots,
        COUNT(*) AS total
      FROM clicks
      WHERE link_id = ANY(v_link_ids) AND created_at >= v_since
      GROUP BY 1
  ), ds_countries AS (
      SELECT 
        key as code,
        SUM(value::int) as total
      FROM daily_stats, jsonb_each_text(country_breakdown)
      WHERE link_id = ANY(v_link_ids) AND day >= v_since::date
        AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
      GROUP BY 1
  ), combined_countries AS (
      SELECT code, SUM(humans) as humans, SUM(bots) as bots, SUM(total) as total
      FROM (
          SELECT code, humans, bots, total FROM click_countries
          UNION ALL
          SELECT code, total as humans, 0 as bots, total FROM ds_countries -- daily stats breakdown is simplified
      ) c
      GROUP BY code
  )
  SELECT jsonb_agg(t ORDER BY t.total DESC)
    INTO v_countries
  FROM (
    SELECT * FROM combined_countries ORDER BY total DESC LIMIT 10
  ) t;

  -- Devices (live clicks only for now as it's harder to merge accurately from old ds)
  SELECT jsonb_agg(t ORDER BY t.cnt DESC)
    INTO v_devices
  FROM (
    SELECT ua_device(ua) AS name, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot
    GROUP BY 1
  ) t;

  -- Browsers (live clicks)
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

  -- OS (live clicks)
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

  -- Bot reasons
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

  -- Top links
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

  -- Live events
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

-- 2. Update get_dashboard_stats to be Hybrid
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
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

  -- 30-day daily series (Hybrid: Clicks + DailyStats)
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ), click_agg AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY 1
  ), ds_agg AS (
    SELECT day as d, SUM(human_clicks) as cnt
    FROM daily_stats
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined AS (
    SELECT d, cnt FROM click_agg
    UNION ALL
    SELECT d, cnt FROM ds_agg
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(a.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN (SELECT d, SUM(cnt) as cnt FROM combined GROUP BY 1) a ON a.d = d.d;

  -- Country counts (Hybrid)
  WITH click_cty AS (
    SELECT country, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30
    GROUP BY country
  ), ds_cty AS (
    SELECT key as country, SUM(value::int) as cnt
    FROM daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
      AND day NOT IN (SELECT DISTINCT created_at::date FROM clicks WHERE link_id = ANY(v_link_ids))
    GROUP BY 1
  ), combined_cty AS (
    SELECT country, SUM(cnt) as cnt FROM (
      SELECT country, cnt FROM click_cty
      UNION ALL
      SELECT country, cnt FROM ds_cty
    ) t GROUP BY 1
  )
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM combined_cty;

  -- Mobile percentage (Last 7 days from clicks is enough of a sample)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')
  INTO v_mobile_total, v_mobile_count
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30;

  IF v_mobile_total > 0 THEN
    v_mobile_pct := ROUND((v_mobile_count::numeric / v_mobile_total::numeric) * 100)::int;
  END IF;

  -- Unique visitors (30d from clicks - note: won't include purged data accurately but IP changes anyway)
  SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
  FROM clicks
  WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= v_since30 AND ip IS NOT NULL;

  -- Per-link 7-day sparkline (clicks is fine here)
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ), agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*) AS cnt
    FROM clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at >= (now() - interval '7 days')
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
