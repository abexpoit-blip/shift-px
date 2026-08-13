DROP FUNCTION IF EXISTS public.get_analytics_summary(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_analytics_summary(_user_id uuid, _days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
   -- 1. Resolve owned link ids
   SELECT array_agg(id), jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title))
     INTO v_link_ids, v_links
   FROM links WHERE user_id = _user_id;

   IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
     RETURN jsonb_build_object('empty', true);
   END IF;

   -- 2. KPI scan (live clicks) for time-bounded stats
   SELECT
     COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
     COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
     COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
   INTO v_last24, v_last24_humans, v_last60s
   FROM clicks
   WHERE link_id = ANY(v_link_ids) AND created_at >= v_since;

   -- Use persistent totals from links table for accuracy across purges
   SELECT
     COALESCE(SUM(clicks_count), 0),
     COALESCE(SUM(bot_clicks_count), 0),
     COALESCE(SUM(ours_clicks_count), 0),
     COALESCE(SUM(offer_clicks_count), 0)
   INTO v_humans, v_bots, v_ours, v_offers
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

   -- 4. 7d x 24h heatmap
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

   -- 5. Countries
   SELECT jsonb_agg(jsonb_build_object('code', country, 'humans', COUNT(*) FILTER (WHERE NOT is_bot), 'bots', COUNT(*) FILTER (WHERE is_bot)))
     INTO v_countries
   FROM (SELECT country, is_bot FROM clicks WHERE link_id = ANY(v_link_ids) AND created_at >= v_since LIMIT 50000) AS c
   GROUP BY country
   ORDER BY COUNT(*) DESC
   LIMIT 20;

   -- 6. Browsers, Devices, OS
   SELECT jsonb_agg(jsonb_build_object('name', name, 'cnt', cnt)) INTO v_browsers
   FROM (SELECT ua as name, COUNT(*) as cnt FROM clicks WHERE link_id = ANY(v_link_ids) AND created_at >= v_since AND NOT is_bot GROUP BY ua LIMIT 10) as b;

   -- 7. Live Events (last 20)
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
     'hourly', COALESCE(v_hourly, '[]'::jsonb),
     'heatmap', COALESCE(v_heatmap, '[]'::jsonb),
     'heatMax', COALESCE(v_heatmax, 0),
     'countries', COALESCE(v_countries, '[]'::jsonb),
     'browsers', COALESCE(v_browsers, '[]'::jsonb),
     'liveEvents', COALESCE(v_live, '[]'::jsonb)
   );
 END;
 $function$;
