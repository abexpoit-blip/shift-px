-- ==============================================================================
-- AdsPx v2 Package & Monetisation System Migration
-- Run this ONCE on VPS:
--   PGPASSWORD=d15ea36d3875a41833af1d96a5517d3b34ae118740984102 psql -h 127.0.0.1 -U postgres -d postgres -f /var/www/swiftpx/deploy/upgrade-packages-and-monetisation.sql
-- ==============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. PACKAGES: Replace old plans with Free / 6-Month / 12-Month
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS price_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_quota     INTEGER, -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS link_limit      INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_premium      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_withdraw    BOOLEAN NOT NULL DEFAULT false;

-- Wipe stale seeded plans
DELETE FROM public.packages WHERE slug IN ('starter','pro','agency','monthly','monthly_pro','annual');

-- Insert the three canonical plans
INSERT INTO public.packages (slug, name, price_monthly, price_usd, duration_months, link_limit, click_quota, is_premium, can_withdraw, features, sort_order, is_active)
VALUES
  ('free', 'Free', 0, 0, 0, 50, NULL, false, false,
   '["50 short links","Unlimited clicks","Earn from every human visit","No withdrawal (upgrade to cash out)"]'::jsonb, 0, true),
  ('premium_6m', 'Premium — 6 Months', 60, 60, 6, 100000, NULL, true, true,
   '["Unlimited short links","Unlimited clicks","Priority support","Withdraw earnings (min $5)","All analytics features"]'::jsonb, 1, true),
  ('premium_12m', 'Premium — 12 Months', 100, 100, 12, 100000, NULL, true, true,
   '["Unlimited short links","Unlimited clicks","Priority support","Withdraw earnings (min $5)","All analytics features","2 months FREE ($120 → $100)"]'::jsonb, 2, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, price_monthly = EXCLUDED.price_monthly, price_usd = EXCLUDED.price_usd,
  duration_months = EXCLUDED.duration_months, link_limit = EXCLUDED.link_limit,
  click_quota = EXCLUDED.click_quota, is_premium = EXCLUDED.is_premium,
  can_withdraw = EXCLUDED.can_withdraw, features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- ────────────────────────────────────────────────────────────────
-- 2. PROFILES: Track premium_until and link limits properly
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_slug           TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS premium_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_limit          INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS click_quota         INTEGER,
  ADD COLUMN IF NOT EXISTS can_withdraw        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_available   NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pending     NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_withdrawn   NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS links_used          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_used         INTEGER NOT NULL DEFAULT 0;

-- Update free users to correct defaults
UPDATE public.profiles SET
  plan_slug = 'free',
  link_limit = 50,
  click_quota = NULL,
  can_withdraw = false
WHERE plan_slug NOT IN ('premium_6m','premium_12m') OR plan_slug IS NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. APP_SETTINGS: Earnings rate, minimum withdrawal, Plisio key
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS earning_rate_per_1k  NUMERIC(10,6) NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS min_withdrawal_usd   NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS plisio_api_key        TEXT,
  ADD COLUMN IF NOT EXISTS plisio_secret_key     TEXT,
  ADD COLUMN IF NOT EXISTS plisio_enabled        BOOLEAN NOT NULL DEFAULT false;

-- Set earnings to $1 per 50,000 clicks  = $0.02 per 1,000
-- Minimum withdrawal = $5, premium only
UPDATE public.app_settings SET
  earning_rate_per_1k = 0.02,    -- $1 per 50k clicks ($0.02 per 1k)
  min_withdrawal_usd  = 5.00;

-- ────────────────────────────────────────────────────────────────
-- 4. UPGRADE_REQUESTS table (Plisio self-hosted invoices)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  package_slug     TEXT NOT NULL,
  amount_usd       NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | expired
  plisio_invoice_id  TEXT,
  plisio_invoice_url TEXT,
  crypto_currency  TEXT,
  crypto_amount    TEXT,
  crypto_address   TEXT,
  paid_at          TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  admin_note       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own upgrade_requests" ON public.upgrade_requests;
DROP POLICY IF EXISTS "All manage upgrade_requests" ON public.upgrade_requests;
CREATE POLICY "All manage upgrade_requests" ON public.upgrade_requests FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE ON public.upgrade_requests TO authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────
-- 5. request_withdrawal RPC: enforce premium + $5 minimum
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount  NUMERIC,
  _network TEXT,
  _address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_profile   RECORD;
  v_min       NUMERIC;
  v_pending   INT;
  v_id        UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT p.is_banned, p.can_withdraw, p.balance_available, a.min_withdrawal_usd
    INTO v_profile
    FROM public.profiles p
    CROSS JOIN (SELECT COALESCE(MIN(min_withdrawal_usd), 5) AS min_withdrawal_usd FROM public.app_settings LIMIT 1) a
   WHERE p.id = v_user_id;

  IF v_profile.is_banned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_suspended');
  END IF;

  -- Premium-only gate
  IF NOT COALESCE(v_profile.can_withdraw, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'premium_required');
  END IF;

  v_min := COALESCE(v_profile.min_withdrawal_usd, 5);
  IF _amount < v_min THEN
    RETURN jsonb_build_object('ok', false, 'error', 'below_minimum');
  END IF;

  IF _amount > v_profile.balance_available THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  -- Only one pending withdrawal at a time
  SELECT COUNT(*) INTO v_pending
    FROM public.withdrawals
   WHERE user_id = v_user_id AND status = 'pending';
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pending_request_exists');
  END IF;

  -- Deduct balance and create request (balance confirmed when admin approves)
  INSERT INTO public.withdrawals (user_id, amount_usd, network, wallet_address, status)
  VALUES (v_user_id, _amount, _network, _address, 'pending')
  RETURNING id INTO v_id;

  UPDATE public.profiles
     SET balance_available = balance_available - _amount,
         balance_pending   = balance_pending + _amount
   WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(NUMERIC, TEXT, TEXT) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────
-- 6. activate_premium RPC (admin or webhook calls this)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_premium(
  _user_id     UUID,
  _package_slug TEXT,
  _upgrade_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg        RECORD;
  v_until      TIMESTAMPTZ;
  v_cur_until  TIMESTAMPTZ;
BEGIN
  SELECT slug, duration_months, link_limit, click_quota, can_withdraw
    INTO v_pkg
    FROM public.packages
   WHERE slug = _package_slug AND is_active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_package');
  END IF;

  -- If user already has premium and it's not expired, extend from current expiry
  SELECT premium_until INTO v_cur_until FROM public.profiles WHERE id = _user_id;
  IF v_cur_until IS NOT NULL AND v_cur_until > now() THEN
    v_until := v_cur_until + (v_pkg.duration_months || ' months')::INTERVAL;
  ELSE
    v_until := now() + (v_pkg.duration_months || ' months')::INTERVAL;
  END IF;

  UPDATE public.profiles SET
    plan_slug     = v_pkg.slug,
    premium_until = v_until,
    link_limit    = v_pkg.link_limit,
    click_quota   = v_pkg.click_quota,
    can_withdraw  = v_pkg.can_withdraw,
    updated_at    = now()
  WHERE id = _user_id;

  -- Mark the upgrade request as paid
  IF _upgrade_request_id IS NOT NULL THEN
    UPDATE public.upgrade_requests SET
      status  = 'paid',
      paid_at = now(),
      updated_at = now()
    WHERE id = _upgrade_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'premium_until', v_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_premium(UUID, TEXT, UUID) TO service_role, postgres;

-- ────────────────────────────────────────────────────────────────
-- 7. Auto-expire premium when premium_until passes
--    (called nightly via pg_cron or manually)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_premium_plans()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    plan_slug    = 'free',
    link_limit   = 50,
    click_quota  = NULL,
    can_withdraw = false,
    premium_until = NULL,
    updated_at   = now()
  WHERE premium_until IS NOT NULL
    AND premium_until < now()
    AND plan_slug != 'free';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_premium_plans() TO service_role, postgres;

-- ────────────────────────────────────────────────────────────────
-- 8. Update handle_new_user to use 'free' plan & correct defaults
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan_slug, link_limit, can_withdraw, is_banned)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'free',
    50,
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    plan_slug  = COALESCE(profiles.plan_slug, 'free'),
    link_limit = COALESCE(profiles.link_limit, 50);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────
-- 9. Enforce link limit on insert (block free users past 50 links)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_link_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT COALESCE(link_limit, 50) INTO v_limit FROM public.profiles WHERE id = NEW.user_id;
  SELECT COUNT(*) INTO v_count FROM public.links WHERE user_id = NEW.user_id AND (is_active IS NULL OR is_active = true);
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Link limit reached. Upgrade to premium for unlimited links.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_link_limit ON public.links;
CREATE TRIGGER enforce_link_limit
BEFORE INSERT ON public.links
FOR EACH ROW EXECUTE FUNCTION public.check_link_limit();

-- ────────────────────────────────────────────────────────────────
-- 10. Grants & reload
-- ────────────────────────────────────────────────────────────────
GRANT ALL ON public.upgrade_requests TO authenticated, service_role, postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';
