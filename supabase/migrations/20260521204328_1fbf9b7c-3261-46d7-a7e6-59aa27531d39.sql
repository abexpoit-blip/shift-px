ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS plisio_invoice_id text,
  ADD COLUMN IF NOT EXISTS plisio_invoice_url text,
  ADD COLUMN IF NOT EXISTS plisio_status text;

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_plisio_invoice
  ON public.upgrade_requests (plisio_invoice_id);

ALTER TABLE public.packages
  ALTER COLUMN link_limit DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS click_limit bigint,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_onetime numeric NOT NULL DEFAULT 0;

UPDATE public.profiles
SET plan_slug = 'free'
WHERE plan_slug IN ('starter', 'pro', 'agency');

DELETE FROM public.packages
WHERE slug IN ('starter', 'pro', 'agency');

INSERT INTO public.packages
  (slug, name, price_monthly, price_onetime, billing_period, link_limit, click_limit, features, is_active, sort_order)
VALUES
  (
    'free',
    'Free',
    0,
    0,
    'free',
    1,
    10000,
    '["1 short link","10,000 clicks / month","Smart bot & fraud detection","In-app browser relief (FB/IG/TikTok)","Geo / device / OS / time targeting","Custom prelander variants (rotating articles)","Duplicate click protection","Basic analytics (clicks, geo, device)","Shared safe domains","Community support"]'::jsonb,
    true,
    0
  ),
  (
    'pro_monthly',
    'Pro Monthly',
    5,
    0,
    'monthly',
    50,
    1000000,
    '["50 short links","1,000,000 clicks / month","Smart bot & fraud detection (advanced)","In-app browser relief + soft challenges","Geo / device / OS / time / referer targeting","Unlimited prelander variants","Auto-rotating A/B variants with autopilot","Custom domains (unlimited)","Domain health monitoring","Duplicate click protection (custom window)","Multi-destination weighted rotation","Custom branding (logo, color, tagline)","Advanced analytics (UTM, referer, breakdown)","Per-link variant overrides","ASN / IP blocklist","Referer rules engine","Priority support"]'::jsonb,
    true,
    1
  ),
  (
    'lifetime',
    'Lifetime',
    0,
    50,
    'lifetime',
    NULL,
    NULL,
    '["Unlimited short links","Unlimited clicks — forever","Everything in Pro Monthly","All current & future features","Unlimited custom domains","Unlimited prelander variants","Full targeting suite (geo/device/OS/time/referer)","Auto-tuning variant autopilot","Multi-destination rotation","Custom branding per link","Advanced analytics + exports","ASN / IP / referer blocklists","API access","Priority support — lifetime","One-time payment — no renewals ever"]'::jsonb,
    true,
    2
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_onetime = EXCLUDED.price_onetime,
  billing_period = EXCLUDED.billing_period,
  link_limit = EXCLUDED.link_limit,
  click_limit = EXCLUDED.click_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

UPDATE public.profiles p
SET link_quota = COALESCE(pk.link_limit, 999999)
FROM public.packages pk
WHERE pk.slug = p.plan_slug;

NOTIFY pgrst, 'reload schema';