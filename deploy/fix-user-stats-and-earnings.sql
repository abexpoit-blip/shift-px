-- ==============================================================================
-- AdsPx: Real-Time User Stats, Live Dashboard & Earnings Backfill Migration
-- Run: docker exec -i supabase-db psql -U postgres -d postgres < /var/www/swiftpx/deploy/fix-user-stats-and-earnings.sql
-- ==============================================================================

-- 1. Create missing helper function ua_device
CREATE OR REPLACE FUNCTION public.ua_device(_ua text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ua ~* 'ipad|tablet|playbook|silk' THEN 'tablet'
    WHEN _ua ~* 'mobile|iphone|android|phone|webos|opera mini' THEN 'mobile'
    ELSE 'desktop'
  END;
$$;

-- 2. Ensure earnings_ledger table exists
CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  human_clicks integer NOT NULL DEFAULT 0,
  bot_clicks integer NOT NULL DEFAULT 0,
  earnings_usd numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_earnings_ledger_user_day ON public.earnings_ledger(user_id, day DESC);
GRANT ALL ON TABLE public.earnings_ledger TO service_role, postgres;
GRANT SELECT ON TABLE public.earnings_ledger TO authenticated;

-- 3. Robust get_dashboard_stats RPC (Real-time live aggregation from clicks + links)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_ids uuid[];
  v_mobile_pct numeric := 0;
  v_unique_visitors integer := 0;
  v_clicks_by_day jsonb := '{}'::jsonb;
  v_country_stats jsonb := '{}'::jsonb;
BEGIN
  -- Get user links
  SELECT ARRAY_AGG(id) INTO v_link_ids
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'clicksByDay', '{}'::jsonb,
      'countryStats', '{}'::jsonb,
      'mobilePct', 0,
      'uniqueVisitors', 0,
      'perLinkDaily', '{}'::jsonb
    );
  END IF;

  -- Aggregate clicks by day (last 30 days) from live clicks table
  SELECT COALESCE(jsonb_object_agg(day_str, cnt), '{}'::jsonb) INTO v_clicks_by_day
  FROM (
    SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_str,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= (now() - interval '30 days')
    GROUP BY 1
  ) t;

  -- Country breakdown (human clicks)
  SELECT COALESCE(jsonb_object_agg(country, cnt), '{}'::jsonb) INTO v_country_stats
  FROM (
    SELECT
      COALESCE(NULLIF(country, ''), 'Unknown') AS country,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 20
  ) c;

  -- Mobile percentage & unique IPs
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE NOT is_bot AND (ua ~* 'mobile|iphone|android|phone|webos|opera mini|ipad|tablet'))::numeric /
      GREATEST(1, COUNT(*) FILTER (WHERE NOT is_bot))::numeric) * 100,
      1
    ),
    COUNT(DISTINCT ip) FILTER (WHERE NOT is_bot)::integer
  INTO v_mobile_pct, v_unique_visitors
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids);

  RETURN jsonb_build_object(
    'clicksByDay', v_clicks_by_day,
    'countryStats', v_country_stats,
    'mobilePct', COALESCE(v_mobile_pct, 0),
    'uniqueVisitors', COALESCE(v_unique_visitors, 0),
    'perLinkDaily', '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated, service_role, postgres;

-- 4. Real-time click recorder with earnings auto-credit
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earning_rate numeric(12,6) := 0.02; -- $1 per 50k clicks ($0.02 per 1k)
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  -- Fetch configured earning rate if available
  SELECT COALESCE(earning_rate_per_1k, 0.02) INTO v_earning_rate
  FROM public.app_settings
  LIMIT 1;

  -- Insert raw click rows
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    NULLIF(e->>'link_id', '')::uuid,
    NULLIF(e->>'ip', ''),
    NULLIF(e->>'country', ''),
    NULLIF(e->>'ua', ''),
    COALESCE((e->>'is_bot')::boolean, false),
    NULLIF(e->>'bot_reason', ''),
    COALESCE(NULLIF(e->>'routed_to', ''), 'offer'),
    NULLIF(e->>'utm_source', ''),
    NULLIF(e->>'utm_medium', ''),
    NULLIF(e->>'utm_campaign', ''),
    NULLIF(e->>'utm_term', ''),
    NULLIF(e->>'utm_content', ''),
    NULLIF(e->>'referer_host', ''),
    COALESCE(NULLIF(e->>'bot_score', '')::integer, 0),
    COALESCE(e->'signals', '{}'::jsonb),
    COALESCE((e->>'challenge_passed')::boolean, false)
  FROM jsonb_array_elements(_events) AS e
  WHERE NULLIF(e->>'link_id', '') IS NOT NULL
  LIMIT 500;

  -- Update bot click counter on links
  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT NULLIF(e->>'link_id', '')::uuid AS link_id, COUNT(*)::integer AS n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = true
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  -- Update human click counter on links
  UPDATE public.links l
  SET clicks_count       = COALESCE(l.clicks_count, 0)       + s.n,
      human_clicks_count = COALESCE(l.human_clicks_count, 0) + s.n,
      ours_clicks_count  = COALESCE(l.ours_clicks_count, 0)  + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at    = now()
  FROM (
    SELECT
      NULLIF(e->>'link_id', '')::uuid AS link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer  AS ours_n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'offer')::integer AS offer_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  -- Update profile click counters & credit balance_available in real time
  UPDATE public.profiles p
  SET clicks_used       = COALESCE(p.clicks_used, 0)       + s.n,
      ours_clicks       = COALESCE(p.ours_clicks, 0)       + s.ours_n,
      balance_available = COALESCE(p.balance_available, 0) + (s.n * (v_earning_rate / 1000.0))
  FROM (
    SELECT
      NULLIF(e->>'user_id', '')::uuid AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer AS ours_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'user_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;

  -- Upsert into earnings_ledger
  INSERT INTO public.earnings_ledger (user_id, day, human_clicks, bot_clicks, earnings_usd)
  SELECT
    u.user_id,
    CURRENT_DATE,
    u.humans,
    u.bots,
    ROUND((u.humans * (v_earning_rate / 1000.0)), 4)
  FROM (
    SELECT
      NULLIF(e->>'user_id', '')::uuid AS user_id,
      COUNT(*) FILTER (WHERE COALESCE((e->>'is_bot')::boolean, false) = false)::integer AS humans,
      COUNT(*) FILTER (WHERE COALESCE((e->>'is_bot')::boolean, false) = true)::integer  AS bots
    FROM jsonb_array_elements(_events) AS e
    WHERE NULLIF(e->>'user_id', '') IS NOT NULL
    GROUP BY 1
  ) AS u
  ON CONFLICT (user_id, day) DO UPDATE SET
    human_clicks = public.earnings_ledger.human_clicks + EXCLUDED.human_clicks,
    bot_clicks   = public.earnings_ledger.bot_clicks   + EXCLUDED.bot_clicks,
    earnings_usd = public.earnings_ledger.earnings_usd + EXCLUDED.earnings_usd,
    updated_at   = now();

END;
$$;

GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role, postgres;

-- 5. Backfill all existing clicks and balances for all users
DO $$
DECLARE
  v_rate numeric(12,6) := 0.02;
BEGIN
  SELECT COALESCE(earning_rate_per_1k, 0.02) INTO v_rate FROM public.app_settings LIMIT 1;

  -- Update links clicks_count from raw clicks
  UPDATE public.links l
  SET clicks_count = COALESCE(c.humans, 0),
      human_clicks_count = COALESCE(c.humans, 0),
      bot_clicks_count = COALESCE(c.bots, 0)
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS humans,
      COUNT(*) FILTER (WHERE is_bot)::integer AS bots
    FROM public.clicks
    GROUP BY link_id
  ) c
  WHERE l.id = c.link_id;

  -- Update profiles clicks_used and balance_available
  UPDATE public.profiles p
  SET clicks_used = COALESCE(u.humans, 0),
      balance_available = ROUND((COALESCE(u.humans, 0) * (v_rate / 1000.0)), 4)
  FROM (
    SELECT
      l.user_id,
      COUNT(*) FILTER (WHERE NOT c.is_bot)::integer AS humans
    FROM public.links l
    JOIN public.clicks c ON c.link_id = l.id
    GROUP BY l.user_id
  ) u
  WHERE p.id = u.user_id;

  -- Populate earnings_ledger from past clicks
  INSERT INTO public.earnings_ledger (user_id, day, human_clicks, bot_clicks, earnings_usd)
  SELECT
    l.user_id,
    (c.created_at AT TIME ZONE 'UTC')::date AS day,
    COUNT(*) FILTER (WHERE NOT c.is_bot)::integer AS humans,
    COUNT(*) FILTER (WHERE c.is_bot)::integer AS bots,
    ROUND((COUNT(*) FILTER (WHERE NOT c.is_bot) * (v_rate / 1000.0)), 4) AS earnings
  FROM public.links l
  JOIN public.clicks c ON c.link_id = l.id
  GROUP BY l.user_id, 2
  ON CONFLICT (user_id, day) DO UPDATE SET
    human_clicks = EXCLUDED.human_clicks,
    bot_clicks   = EXCLUDED.bot_clicks,
    earnings_usd = EXCLUDED.earnings_usd,
    updated_at   = now();
END;
$$;
