-- ==============================================================================
-- CRITICAL FIX: Restore record_redirect_clicks_batch function + grant service_role
-- Run: docker exec -i supabase-db psql -U postgres -d postgres < /var/www/swiftpx/deploy/fix-click-recording.sql
-- ==============================================================================

-- 1. Re-create the click recording function (idempotent CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

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

  -- Update profile click counters
  UPDATE public.profiles p
  SET clicks_used  = COALESCE(p.clicks_used, 0)  + s.n,
      ours_clicks  = COALESCE(p.ours_clicks, 0)  + s.ours_n
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

END;
$$;

-- 2. Fix grants: service_role MUST have EXECUTE on this function
--    (PostgREST uses service_role to call RPCs from server-side)
REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role, postgres;

-- 3. Also make sure clicks table exists and has proper grants
CREATE TABLE IF NOT EXISTS public.clicks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id           UUID,
  ip                TEXT,
  country           TEXT,
  ua                TEXT,
  is_bot            BOOLEAN NOT NULL DEFAULT false,
  bot_reason        TEXT,
  routed_to         TEXT NOT NULL DEFAULT 'offer',
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_term          TEXT,
  utm_content       TEXT,
  referer_host      TEXT,
  bot_score         INTEGER NOT NULL DEFAULT 0,
  signals           JSONB NOT NULL DEFAULT '{}',
  challenge_passed  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open RLS on clicks (inserts done as SECURITY DEFINER function)
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All access clicks" ON public.clicks;
CREATE POLICY "All access clicks" ON public.clicks FOR ALL USING (true);

GRANT INSERT, SELECT ON public.clicks TO service_role, postgres, authenticated, anon;

-- 4. Add ours_clicks column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ours_clicks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clicks_used INTEGER NOT NULL DEFAULT 0;

-- 5. Add click counter columns to links if missing
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS clicks_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS bot_clicks_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS ours_clicks_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS offer_clicks_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

-- 6. Clean up blocked_countries on links (default to empty array)
ALTER TABLE public.links ALTER COLUMN blocked_countries SET DEFAULT '{}'::text[];
UPDATE public.links SET blocked_countries = '{}' WHERE blocked_countries = '{"US"}';

-- 7. Full grants on everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role, postgres;

-- 8. Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'fix-click-recording.sql applied successfully' AS result;
