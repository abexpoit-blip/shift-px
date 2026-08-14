-- 34: Legacy safe_url cleanup
-- Old links stored the SaaS homepage (sleepox.com / adspx.com / adswapx.com root)
-- as their "safe page". That must never be served to crawlers or ad reviewers.
-- NULL means: use our rotating built-in safe-article pool.

UPDATE public.links
SET safe_url = NULL
WHERE safe_url IS NOT NULL
  AND (
    safe_url ~* '^https?://(www\.)?(sleepox|adspx|adswapx)\.com/?$'
    OR btrim(safe_url) = ''
    OR safe_url !~* '^https?://'
  );

NOTIFY pgrst, 'reload schema';
