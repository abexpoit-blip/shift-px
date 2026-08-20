-- ==============================================================================
-- Seed / Update Canonical 3 Packages: Free, Premium 6M, Premium 12M
-- Run: docker exec -i supabase-db psql -U postgres -d postgres < /var/www/swiftpx/deploy/update-premium-packages.sql
-- ==============================================================================

DELETE FROM public.packages WHERE slug IN ('free', 'premium_6m', 'premium_12m', 'lifetime', 'unlimited');

INSERT INTO public.packages (
  id, slug, name, price_monthly, price_usd, duration_months,
  link_limit, click_quota, is_premium, can_withdraw, is_active, sort_order, features
) VALUES
(
  '4ba67f94-b9b8-4584-bef8-650967339fc4',
  'free',
  'Free Plan',
  0.00,
  0,
  0,
  50,
  NULL,
  false,
  false,
  true,
  0,
  '["50 Short Links limit", "Unlimited clicks & visits", "Earn $1 per 50,000 verified visits", "Standard Meta & Facebook bot cloaking", "Real-time click & country analytics", "No withdrawal (Upgrade to cash out)"]'::jsonb
),
(
  '28c0fd4b-6c3d-44a3-9dc9-439a54331de6',
  'premium_6m',
  'Premium — 6 Months',
  10.00,
  60,
  6,
  1000000,
  NULL,
  true,
  true,
  true,
  1,
  '["Unlimited Short Links", "Unlimited traffic & Tier-1 fast routing", "Instant Cashouts Enabled (Min $5 USDT)", "Advanced Facebook Ad Review Cloaking", "Geo-Targeting & Multi-Offer A/B Rotation", "Dynamic SubID & UTM tracking forwarding", "Priority VIP Telegram & Discord Support"]'::jsonb
),
(
  'bbae5a92-2d4c-4d62-8722-f6c70e091d40',
  'premium_12m',
  'Premium — 12 Months',
  8.33,
  100,
  12,
  1000000,
  NULL,
  true,
  true,
  true,
  2,
  '["Everything in 6-Month Plan included", "Save $20 (2 Months FREE — $120 → $100)", "Unlimited Short Links & Max Speed CDNs", "Instant Lifetime Withdrawals (Min $5)", "Custom Short Domains Connection", "Dedicated High-Priority Server Queue", "Real-Time Click Logs & Audit Export", "24/7 Dedicated VIP Account Manager"]'::jsonb
);
