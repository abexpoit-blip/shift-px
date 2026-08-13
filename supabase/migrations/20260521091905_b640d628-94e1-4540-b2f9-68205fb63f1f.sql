
ALTER TABLE public.packages
  ALTER COLUMN link_limit DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS click_limit BIGINT,
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_onetime NUMERIC NOT NULL DEFAULT 0;

UPDATE public.profiles
SET plan_slug = 'free'
WHERE plan_slug IN ('starter', 'pro', 'agency');

DELETE FROM public.packages
WHERE slug IN ('free', 'starter', 'pro', 'agency');

INSERT INTO public.packages
  (slug, name, price_monthly, price_onetime, billing_period, link_limit, click_limit, features, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 0, 'free', 1, 10000,
   '["1 short link","10,000 clicks / month","Bot & fraud detection","Geo / device / time targeting","Custom prelander variants","Basic analytics"]'::jsonb,
   true, 0),
  ('pro_monthly', 'Pro Monthly', 5, 0, 'monthly', 50, 10000000,
   '["50 short links","10,000,000 clicks / month","Bot & fraud detection","Geo / device / time targeting","Unlimited prelander variants","Advanced analytics","Custom domains","Priority support"]'::jsonb,
   true, 1),
  ('lifetime', 'Lifetime', 0, 50, 'lifetime', NULL, NULL,
   '["Unlimited short links","Unlimited clicks","Bot & fraud detection","All targeting features","Unlimited prelander variants","Advanced analytics","Custom domains","API access","Priority support","One-time payment — lifetime access"]'::jsonb,
   true, 2);

UPDATE public.profiles p
SET link_quota = COALESCE(pk.link_limit, 999999)
FROM public.packages pk
WHERE pk.slug = p.plan_slug;
