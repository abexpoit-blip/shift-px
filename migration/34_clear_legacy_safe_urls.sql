-- 34: Legacy safe_url cleanup
-- Old links stored the SaaS homepage (sleepox.com / adspx.com / adswapx.com root)
-- as their "safe page". That must never be served to crawlers or ad reviewers.
-- NULL means: use our rotating built-in safe-article pool.

-- Safe to run before 33: it self-skips when the column is not there yet.
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS safe_url text;

UPDATE public.links
SET safe_url = NULL
WHERE safe_url IS NOT NULL
  AND (
    safe_url ~* '^https?://(www\.)?(sleepox|adspx|adswapx)\.com/?$'
    OR btrim(safe_url) = ''
    OR safe_url !~* '^https?://'
  );

NOTIFY pgrst, 'reload schema';
