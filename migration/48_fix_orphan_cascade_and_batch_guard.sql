-- Migration 48: Fix orphan link cascade and click-batch foreign-key safety
-- Prevents dropped click batches when deleted users' links are visited

-- 1. Remove existing orphan links belonging to previously purged users
DELETE FROM public.links l
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.user_id);

-- 2. Remove existing orphan daily stats pointing to deleted links
DELETE FROM public.daily_stats ds
WHERE NOT EXISTS (SELECT 1 FROM public.links l WHERE l.id = ds.link_id);

-- 3. Add foreign key ON DELETE CASCADE to links(user_id) -> auth.users(id)
-- This ensures future account purges automatically delete all user links, clicks & stats cleanly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_links_user_id' AND table_name = 'links'
  ) THEN
    ALTER TABLE public.links
    ADD CONSTRAINT fk_links_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Add foreign key ON DELETE CASCADE to daily_stats(link_id) -> links(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_daily_stats_link_id' AND table_name = 'daily_stats'
  ) THEN
    ALTER TABLE public.daily_stats
    ADD CONSTRAINT fk_daily_stats_link_id
    FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Bulletproof record_redirect_clicks_batch function
-- Even if an unlinked click arrives, the entire batch succeeds and never drops.
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND EXISTS (SELECT 1 FROM public.links l WHERE l.id = NULLIF(e->>'link_id', '')::uuid)
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

  -- Update profile click counters & credit balance_available in real time (ONLY for existing users)
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

  -- Upsert into earnings_ledger (ONLY for existing auth.users to prevent FK violations)
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
      AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = NULLIF(e->>'user_id', '')::uuid)
    GROUP BY 1
  ) AS u
  ON CONFLICT (user_id, day) DO UPDATE SET
    human_clicks = public.earnings_ledger.human_clicks + EXCLUDED.human_clicks,
    bot_clicks   = public.earnings_ledger.bot_clicks   + EXCLUDED.bot_clicks,
    earnings_usd = public.earnings_ledger.earnings_usd + EXCLUDED.earnings_usd,
    updated_at   = now();

END;
$function$;
