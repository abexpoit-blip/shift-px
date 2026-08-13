
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS click_quota BIGINT,
  ADD COLUMN IF NOT EXISTS clicks_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS clicks_period_kind TEXT NOT NULL DEFAULT 'monthly';

-- Backfill from current plan
UPDATE public.profiles p
SET click_quota = pk.click_limit,
    clicks_period_kind = COALESCE(NULLIF(pk.billing_period,'free'),'monthly')
FROM public.packages pk
WHERE pk.slug = p.plan_slug AND p.click_quota IS NULL;

-- Extend plan-change sync to also keep click_quota in sync
CREATE OR REPLACE FUNCTION public.sync_quota_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link_limit INT;
  v_click_limit BIGINT;
  v_period TEXT;
BEGIN
  IF NEW.plan_slug IS DISTINCT FROM OLD.plan_slug THEN
    SELECT link_limit, click_limit, billing_period
      INTO v_link_limit, v_click_limit, v_period
      FROM public.packages
      WHERE slug = NEW.plan_slug AND is_active = true;
    IF v_link_limit IS NOT NULL THEN
      NEW.link_quota := v_link_limit;
    END IF;
    NEW.click_quota := v_click_limit; -- NULL = unlimited
    NEW.clicks_used := 0;
    NEW.clicks_period_start := now();
    NEW.clicks_period_kind := COALESCE(NULLIF(v_period,'free'),'monthly');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quota_on_plan_change ON public.profiles;
CREATE TRIGGER trg_sync_quota_on_plan_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_quota_on_plan_change();

-- Status reader (used by dashboard)
CREATE OR REPLACE FUNCTION public.get_user_click_status(p_user_id uuid)
RETURNS TABLE(click_quota BIGINT, clicks_used BIGINT, exceeded BOOLEAN, period_kind TEXT, period_start TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id;

  -- Auto-reset monthly window if 30+ days old
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    u := 0;
  END IF;

  RETURN QUERY SELECT q, u, (q IS NOT NULL AND u >= q), k, s;
END;
$$;

-- Atomic increment + over-quota check (used by redirect handler)
CREATE OR REPLACE FUNCTION public.check_and_increment_user_clicks(p_user_id uuid)
RETURNS TABLE(exceeded BOOLEAN, clicks_used BIGINT, click_quota BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, NULL::BIGINT;
    RETURN;
  END IF;

  -- Monthly auto-reset
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    UPDATE public.profiles
       SET clicks_used = 0, clicks_period_start = now()
     WHERE id = p_user_id;
    u := 0;
  END IF;

  -- Unlimited plan (NULL quota) → always allow, still track usage
  IF q IS NULL THEN
    UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, u + 1, NULL::BIGINT;
    RETURN;
  END IF;

  -- Over quota: do NOT increment further (saves writes), just report
  IF u >= q THEN
    RETURN QUERY SELECT TRUE, u, q;
    RETURN;
  END IF;

  UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
  RETURN QUERY SELECT FALSE, u + 1, q;
END;
$$;
