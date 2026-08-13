
-- 1. Fix profiles defaults: new signup = 'free' plan with 10k clicks, 1 link
ALTER TABLE public.profiles ALTER COLUMN plan_slug SET DEFAULT 'free';
ALTER TABLE public.profiles ALTER COLUMN click_quota SET DEFAULT 10000;
ALTER TABLE public.profiles ALTER COLUMN link_limit SET DEFAULT 1;
ALTER TABLE public.profiles ALTER COLUMN link_quota SET DEFAULT 1;

-- 2. Migrate existing 'starter' (legacy) users to 'free' with correct quota
UPDATE public.profiles
SET plan_slug = 'free',
    click_quota = 10000,
    link_limit = 1,
    link_quota = 1
WHERE plan_slug = 'starter';

-- 3. Ensure packages have exact values requested
UPDATE public.packages SET click_quota = 10000,     link_limit = 1       WHERE slug = 'free';
UPDATE public.packages SET click_quota = 1000000,   link_limit = 50      WHERE slug = 'monthly';
UPDATE public.packages SET click_quota = 100000000, link_limit = 1000000 WHERE slug = 'lifetime';

-- 4. Injection logic: every 5000 clicks -> 100 ours -> back to offer
UPDATE public.app_settings SET injection_threshold = 5000, injection_count = 100;
