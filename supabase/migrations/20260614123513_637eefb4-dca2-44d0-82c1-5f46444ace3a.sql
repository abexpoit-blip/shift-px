
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_profile_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota bigint;
  v_links integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan_slug IS NOT DISTINCT FROM OLD.plan_slug THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_slug IN ('unlimited', 'lifetime') THEN
    NEW.click_quota := NULL;
    NEW.link_limit  := NULL;
    NEW.plan_started_at := COALESCE(NEW.plan_started_at, now());
    NEW.plan_expires_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.plan_slug = 'free' THEN
    NEW.plan_started_at := NULL;
    NEW.plan_expires_at := NULL;
  END IF;

  SELECT click_quota, link_limit INTO v_quota, v_links
  FROM public.packages WHERE slug = NEW.plan_slug LIMIT 1;

  IF FOUND THEN
    NEW.click_quota := v_quota;
    NEW.link_limit  := v_links;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  -- Free users: full quota reset (their monthly free allowance refreshes)
  UPDATE public.profiles
  SET clicks_used = 0,
      ours_clicks = 0,
      clicks_period_start = v_now
  WHERE plan_slug = 'free';

  -- Paid users: only reset display counter; clicks_used (quota usage) preserved to prevent exploit
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE plan_slug <> 'free';

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END $$;

CREATE OR REPLACE FUNCTION public.expire_monthly_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH downgraded AS (
    UPDATE public.profiles
    SET plan_slug = 'free'
    WHERE plan_expires_at IS NOT NULL
      AND plan_expires_at < now()
      AND plan_slug NOT IN ('free', 'lifetime', 'unlimited')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM downgraded;
  RETURN jsonb_build_object('ok', true, 'downgraded', v_count, 'at', now());
END $$;

UPDATE public.profiles
SET plan_started_at = COALESCE(plan_started_at, updated_at, created_at),
    plan_expires_at = COALESCE(plan_expires_at, now() + interval '30 days')
WHERE plan_slug = 'monthly'
  AND plan_expires_at IS NULL;

UPDATE public.profiles
SET plan_started_at = COALESCE(plan_started_at, created_at)
WHERE plan_slug IN ('lifetime', 'unlimited')
  AND plan_started_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('expire-monthly-plans')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='expire-monthly-plans');
    PERFORM cron.schedule('expire-monthly-plans', '30 2 * * *', $cron$ SELECT public.expire_monthly_plans(); $cron$);
  END IF;
END $$;
