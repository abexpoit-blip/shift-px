-- Fix check_link_limit to properly enforce Daily Limit for Premium users
-- and Total Limit for Free users, honoring Admin Custom Overrides and Unlimited permissions.

CREATE OR REPLACE FUNCTION public.check_link_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_plan text;
  v_link_limit integer;
  v_today_count integer;
  v_total_count integer;
  v_is_admin boolean;
  v_is_premium boolean;
  v_daily_limit integer;
  v_free_limit integer;
BEGIN
  -- 1. Check if user is admin (admins have no limits)
  SELECT public.has_role(NEW.user_id, 'admin') INTO v_is_admin;
  IF COALESCE(v_is_admin, false) THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch plan_slug and link_limit from profiles
  SELECT COALESCE(plan_slug, 'free'), link_limit
  INTO v_plan, v_link_limit
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_is_premium := (
    v_plan ILIKE '%premium%' OR 
    v_plan IN ('lifetime', 'unlimited', 'monthly', 'yearly')
  );

  -- 3. If user has unlimited limit explicitly (link_limit IS NULL or >= 1000000 or lifetime/unlimited plan)
  -- When Admin gives Unlimited permission, user can create unlimited links without any restriction.
  IF v_link_limit IS NULL OR v_link_limit >= 1000000 OR v_plan IN ('lifetime', 'unlimited') THEN
    RETURN NEW;
  END IF;

  -- 4. If user is Premium: link_limit is their DAILY limit (links per UTC day)
  -- If Admin granted a custom limit (e.g. 20, 50, 100, 500/day), it is strictly honored.
  IF v_is_premium THEN
    v_daily_limit := COALESCE(v_link_limit, 10);

    SELECT COUNT(*) INTO v_today_count
    FROM public.links
    WHERE user_id = NEW.user_id
      AND created_at >= (NOW() AT TIME ZONE 'UTC')::date;

    IF v_today_count >= v_daily_limit THEN
      RAISE EXCEPTION 'Daily link creation limit reached (%/% links created today). You can create more links tomorrow or upgrade for higher limits!', v_today_count, v_daily_limit;
    END IF;

    RETURN NEW;
  END IF;

  -- 5. If user is Free:
  -- Admin might have granted a custom limit (e.g. 20, 50, 100 links), or default 5.
  v_free_limit := COALESCE(v_link_limit, 5);

  -- Total active links check against their allowed limit
  SELECT COUNT(*) INTO v_total_count
  FROM public.links
  WHERE user_id = NEW.user_id
    AND (is_active IS NULL OR is_active = true);

  IF v_total_count >= v_free_limit THEN
    RAISE EXCEPTION 'Link limit reached (%/% total links max). Contact support or upgrade to Premium for higher limits!', v_total_count, v_free_limit;
  END IF;

  -- Daily safety for standard free tier (if limit is <= 5)
  IF v_free_limit <= 5 THEN
    SELECT COUNT(*) INTO v_today_count
    FROM public.links
    WHERE user_id = NEW.user_id
      AND created_at >= (NOW() AT TIME ZONE 'UTC')::date;

    IF v_today_count >= 5 THEN
      RAISE EXCEPTION 'Free tier daily limit reached (5/5 links created today). Upgrade to Premium for higher limits!';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update packages table so free tier has 5 link limit as advertised
UPDATE public.packages SET link_limit = 5 WHERE slug = 'free' AND link_limit = 1;

-- Also update existing free profiles that had link_limit = 1 to 5
UPDATE public.profiles SET link_limit = 5 WHERE plan_slug = 'free' AND link_limit = 1;
