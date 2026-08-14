-- 33: guarantee the modern link URL columns exist (fixes
-- "Could not find the 'adsterra_url' column of 'links' in the schema cache")

ALTER TABLE public.links ADD COLUMN IF NOT EXISTS adsterra_url text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url text;

-- backfill from the legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'links' AND column_name = 'adsterra_direct_link'
  ) THEN
    EXECUTE 'UPDATE public.links SET adsterra_url = COALESCE(adsterra_url, adsterra_direct_link) WHERE adsterra_url IS NULL';
  END IF;
END $$;

-- NOTE: safe_url is deliberately NOT backfilled from destination_url.
-- destination_url is the OFFER page; serving it as the "safe page" would show
-- crawlers/ad reviewers the offer itself. NULL = use our rotating built-in
-- safe-article pool. Repair rows that an older version of this file filled in:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'links' AND column_name = 'destination_url'
  ) THEN
    EXECUTE 'UPDATE public.links SET safe_url = NULL
             WHERE safe_url IS NOT NULL AND destination_url IS NOT NULL
               AND btrim(safe_url) = btrim(destination_url)';
  END IF;
END $$;

-- reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'links'
  AND column_name IN ('adsterra_url', 'safe_url', 'adsterra_direct_link', 'destination_url');
