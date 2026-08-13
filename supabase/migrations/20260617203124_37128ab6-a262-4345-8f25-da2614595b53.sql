-- 1) Wire the sync function as a trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_profile_plan_quota ON public.profiles;
CREATE TRIGGER trg_sync_profile_plan_quota
BEFORE INSERT OR UPDATE OF plan_slug ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_plan_quota();

-- 2) Backfill existing paid users with NULL quota (defensive)
UPDATE public.profiles p
SET click_quota = pk.click_quota,
    link_limit  = pk.link_limit
FROM public.packages pk
WHERE pk.slug = p.plan_slug
  AND p.plan_slug NOT IN ('free', 'lifetime', 'unlimited')
  AND (p.click_quota IS NULL OR p.link_limit IS NULL);