-- ============================================================
-- 47 — Google Shorts Public Directory & 14-Day Traffic Retention
--
-- Features:
-- 1. Table `public.google_shorts` storing user-generated Google Short links
-- 2. Fast indexes on user_id, link_id, short_code, created_at
-- 3. Row Level Security for authenticated users (users see own, admins see all)
-- 4. 14-day zero-traffic link auto-pruning helper procedure
-- ============================================================

DO $$
BEGIN
  -- Flag on links table
  ALTER TABLE public.links ADD COLUMN IF NOT EXISTS is_google_short boolean DEFAULT false;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.google_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  short_code text NOT NULL,
  domain text NOT NULL DEFAULT 'adswapx.com',
  destination_url text NOT NULL,
  google_url text NOT NULL,
  share_google_url text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_shorts_user_id ON public.google_shorts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_shorts_link_id ON public.google_shorts(link_id);
CREATE INDEX IF NOT EXISTS idx_google_shorts_short_code ON public.google_shorts(short_code);
CREATE INDEX IF NOT EXISTS idx_google_shorts_created_at ON public.google_shorts(created_at);

ALTER TABLE public.google_shorts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "google_shorts_select" ON public.google_shorts;
DROP POLICY IF EXISTS "google_shorts_insert" ON public.google_shorts;
DROP POLICY IF EXISTS "google_shorts_delete" ON public.google_shorts;

-- SELECT policy: user can view own; admins can view all
CREATE POLICY "google_shorts_select" ON public.google_shorts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT policy: authenticated users can insert with their own user_id
CREATE POLICY "google_shorts_insert" ON public.google_shorts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- DELETE policy: user can delete own; admins can delete all
CREATE POLICY "google_shorts_delete" ON public.google_shorts
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

GRANT ALL ON public.google_shorts TO authenticated, service_role;

-- 14-day zero-traffic link auto-purge procedure
CREATE OR REPLACE FUNCTION public.purge_dead_links(days_threshold integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff timestamptz;
  deleted_count integer := 0;
  target_ids uuid[];
BEGIN
  cutoff := now() - (days_threshold || ' days')::interval;

  -- Select links created >= days_threshold ago with 0 clicks
  SELECT array_agg(id) INTO target_ids
  FROM public.links
  WHERE (clicks_count = 0 OR clicks_count IS NULL)
    AND (bot_clicks_count = 0 OR bot_clicks_count IS NULL)
    AND created_at < cutoff
  LIMIT 5000;

  IF target_ids IS NOT NULL AND array_length(target_ids, 1) > 0 THEN
    -- Delete associated clicks (if any stale records exist)
    DELETE FROM public.clicks WHERE link_id = ANY(target_ids);
    -- Delete google_shorts references
    DELETE FROM public.google_shorts WHERE link_id = ANY(target_ids);
    -- Delete links
    DELETE FROM public.links WHERE id = ANY(target_ids);
    deleted_count := array_length(target_ids, 1);
  END IF;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_dead_links(integer) TO service_role, postgres;
