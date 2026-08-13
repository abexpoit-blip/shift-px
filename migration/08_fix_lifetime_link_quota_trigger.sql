-- Fix database-side link creation enforcement so lifetime/unlimited plans can
-- create unlimited links. The old trigger still checked the legacy link_quota
-- column, which could stay at 1 and block paid lifetime users.

CREATE OR REPLACE FUNCTION public.enforce_link_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_link_limit integer;
  v_plan text;
BEGIN
  SELECT links_used, link_limit, plan_slug
    INTO v_used, v_link_limit, v_plan
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF v_plan IN ('lifetime', 'unlimited') OR v_link_limit IS NULL THEN
    UPDATE public.profiles
    SET links_used = COALESCE(links_used, 0) + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;

  IF COALESCE(v_used, 0) >= v_link_limit THEN
    RAISE EXCEPTION 'Link quota reached (%/%). Please upgrade your plan.', COALESCE(v_used, 0), v_link_limit;
  END IF;

  UPDATE public.profiles
  SET links_used = COALESCE(links_used, 0) + 1
  WHERE id = NEW.user_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_link_quota ON public.links;
CREATE TRIGGER trg_enforce_link_quota
  BEFORE INSERT ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_link_quota();

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
    RETURN NEW;
  END IF;

  SELECT click_quota, link_limit INTO v_quota, v_links
  FROM public.packages
  WHERE slug = NEW.plan_slug
  LIMIT 1;

  IF FOUND THEN
    NEW.click_quota := v_quota;
    NEW.link_limit  := v_links;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_profile_plan_quota ON public.profiles;
CREATE TRIGGER trg_sync_profile_plan_quota
  BEFORE INSERT OR UPDATE OF plan_slug ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_plan_quota();

-- Repair current package rows so future admin/webhook updates always copy the right rules.
UPDATE public.packages
SET click_quota = CASE
      WHEN slug IN ('lifetime', 'unlimited') THEN NULL
      WHEN slug IN ('monthly', 'pro_monthly') THEN 1000000
      WHEN slug = 'free' THEN 10000
      ELSE click_quota
    END,
    link_limit = CASE
      WHEN slug IN ('lifetime', 'unlimited') THEN NULL
      WHEN slug IN ('monthly', 'pro_monthly') THEN 50
      WHEN slug = 'free' THEN 1
      ELSE link_limit
    END
WHERE slug IN ('free', 'monthly', 'pro_monthly', 'lifetime', 'unlimited');

-- Repair all existing users immediately.
UPDATE public.profiles
SET click_quota = NULL,
    link_limit  = NULL
WHERE plan_slug IN ('lifetime', 'unlimited')
  AND (click_quota IS NOT NULL OR link_limit IS NOT NULL);

UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit  = pk.link_limit
FROM public.packages pk
WHERE p.plan_slug = pk.slug
  AND p.plan_slug NOT IN ('lifetime', 'unlimited')
  AND (p.click_quota IS DISTINCT FROM pk.click_quota
       OR p.link_limit  IS DISTINCT FROM pk.link_limit);

-- Verification output after running this file:
-- free => link_limit 1, monthly/pro_monthly => 50, lifetime/unlimited => NULL (= unlimited)
SELECT slug, click_quota, link_limit
FROM public.packages
WHERE slug IN ('free', 'monthly', 'pro_monthly', 'lifetime', 'unlimited')
ORDER BY slug;

SELECT email, plan_slug, click_quota, link_limit, links_used
FROM public.profiles
WHERE plan_slug IN ('free', 'monthly', 'pro_monthly', 'lifetime', 'unlimited')
ORDER BY plan_slug, email;
