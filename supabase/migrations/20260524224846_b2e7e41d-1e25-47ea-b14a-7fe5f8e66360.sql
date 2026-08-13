-- Sync package pricing/quotas to final published values.
-- Idempotent UPSERT — safe to re-run on any environment (Lovable Cloud or VPS).
INSERT INTO public.packages (slug, name, price_usd, click_quota, link_limit, is_active, sort_order)
VALUES
  ('free',     'Free',               0,  10000,    1,    true, 1),
  ('monthly',  'Monthly Pro',        5,  1000000,  50,   true, 2),
  ('lifetime', 'Lifetime Unlimited', 50, NULL,     NULL, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  price_usd   = EXCLUDED.price_usd,
  click_quota = EXCLUDED.click_quota,
  link_limit  = EXCLUDED.link_limit,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;