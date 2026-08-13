-- Auto-sync click_quota and link_limit from packages whenever plan_slug changes.
-- This protects against any path (admin, webhook, manual edit) leaving NULL quotas.

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
  -- Only act if plan_slug changed (or on insert)
  IF TG_OP = 'UPDATE' AND NEW.plan_slug IS NOT DISTINCT FROM OLD.plan_slug THEN
    RETURN NEW;
  END IF;

  -- 'unlimited' / 'lifetime' legitimately have NULL quotas
  IF NEW.plan_slug IN ('unlimited', 'lifetime') THEN
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

-- One-time backfill: fix all existing non-lifetime users to match their package
UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit  = pk.link_limit
FROM public.packages pk
WHERE p.plan_slug = pk.slug
  AND p.plan_slug NOT IN ('unlimited', 'lifetime')
  AND (p.click_quota IS DISTINCT FROM pk.click_quota
       OR p.link_limit  IS DISTINCT FROM pk.link_limit);
