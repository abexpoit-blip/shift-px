-- ============================================================================
-- 40_profiles_missing_columns.sql
-- Restores every column the app expects on public.profiles / public.links.
-- Fixes: "column profiles.plan_expires_at does not exist" and
--        "Could not find the 'blocked_countries' column of 'links'".
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_started_at        timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS link_limit             integer,
  ADD COLUMN IF NOT EXISTS ours_clicks            bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_quota            bigint,
  ADD COLUMN IF NOT EXISTS clicks_used            bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_period_start    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS balance_available      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pending        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_withdrawn      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_redirect_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_url             text,
  ADD COLUMN IF NOT EXISTS is_banned              boolean NOT NULL DEFAULT false;

-- Backfill link_limit from the legacy link_quota column when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'link_quota'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET link_limit = link_quota WHERE link_limit IS NULL';
  END IF;
END $$;

-- links: everything the redirect engine + dashboard read.
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS blocked_countries  text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS safe_url           text,
  ADD COLUMN IF NOT EXISTS adsterra_url       text,
  ADD COLUMN IF NOT EXISTS destination_url    text,
  ADD COLUMN IF NOT EXISTS prelanding_template text,
  ADD COLUMN IF NOT EXISTS is_active          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clicks_count       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bot_clicks_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ours_clicks_count  integer NOT NULL DEFAULT 0;

-- Keep both URL columns in sync so old/new code paths agree.
UPDATE public.links SET adsterra_url = destination_url
  WHERE adsterra_url IS NULL AND destination_url IS NOT NULL;
UPDATE public.links SET destination_url = adsterra_url
  WHERE destination_url IS NULL AND adsterra_url IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.links TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- Make PostgREST see the new columns immediately.
NOTIFY pgrst, 'reload schema';
