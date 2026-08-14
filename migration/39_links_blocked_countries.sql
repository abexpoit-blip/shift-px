-- ============================================================================
-- 39_links_blocked_countries.sql
-- Restores columns the redirect engine expects on public.links.
-- Fixes: "Could not find the 'blocked_countries' column of 'links' in the
-- schema cache" when creating a link on a self-hosted DB.
-- ============================================================================

ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS blocked_countries text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS safe_url text;

ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS adsterra_url text;

ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- PostgREST schema cache reload so the new columns are visible immediately.
NOTIFY pgrst, 'reload schema';
