UPDATE public.packages SET click_quota = 10000 WHERE slug = 'starter';
UPDATE public.packages SET click_quota = 1000000 WHERE slug = 'pro';
UPDATE public.packages SET click_quota = 10000000 WHERE slug = 'agency';

-- Also update existing profiles to match the new defaults if they are on those plans
UPDATE public.profiles SET click_quota = 10000 WHERE plan_slug = 'starter' AND click_quota < 10000;
UPDATE public.profiles SET click_quota = 1000000 WHERE plan_slug = 'pro' AND click_quota < 1000000;
UPDATE public.profiles SET click_quota = 10000000 WHERE plan_slug = 'agency' AND click_quota < 10000000;
