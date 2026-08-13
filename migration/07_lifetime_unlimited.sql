-- Ensure lifetime/unlimited plans get NULL quotas (= unlimited) on every plan change,
-- and backfill any existing lifetime/unlimited users who are stuck on old limits.

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

  -- Unlimited plans: clear quotas explicitly so old values don't carry over
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

-- Backfill: any lifetime/unlimited user must have NULL quota + NULL link_limit
UPDATE public.profiles
SET click_quota = NULL,
    link_limit  = NULL
WHERE plan_slug IN ('lifetime', 'unlimited')
  AND (click_quota IS NOT NULL OR link_limit IS NOT NULL);

-- Backfill all other plans from packages (safety net for free/monthly)
UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit  = pk.link_limit
FROM public.packages pk
WHERE p.plan_slug = pk.slug
  AND p.plan_slug NOT IN ('lifetime', 'unlimited')
  AND (p.click_quota IS DISTINCT FROM pk.click_quota
       OR p.link_limit  IS DISTINCT FROM pk.link_limit);
