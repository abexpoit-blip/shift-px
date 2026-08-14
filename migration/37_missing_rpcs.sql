-- ============================================================
-- 37 — Restore RPCs the app calls but that were never shipped
--      (each one currently returns 500 / "function does not exist")
--      Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. bot_whitelist (read by the redirect hot path)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_whitelist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type  text NOT NULL,                  -- ua | ip | referer | asn
  pattern    text NOT NULL,
  label      text,
  is_active  boolean NOT NULL DEFAULT true,
  hits       bigint  NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_whitelist_active_idx
  ON public.bot_whitelist (is_active) WHERE is_active = true;

GRANT SELECT ON public.bot_whitelist TO authenticated;
GRANT ALL    ON public.bot_whitelist TO service_role;
ALTER TABLE public.bot_whitelist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read whitelist" ON public.bot_whitelist;
CREATE POLICY "auth read whitelist" ON public.bot_whitelist
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_whitelist_hit(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.bot_whitelist
     SET hits = hits + 1, last_hit_at = now()
   WHERE id = _id;
$function$;
GRANT EXECUTE ON FUNCTION public.record_whitelist_hit(uuid) TO service_role;

-- ------------------------------------------------------------
-- 2. Inactive / dormant user reports (admin control panel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_inactive_users()
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  days_inactive integer,
  link_count bigint,
  clicks_used bigint,
  plan_slug text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $function$
  SELECT
    u.id,
    COALESCE(p.email, u.email)::text,
    u.created_at,
    u.last_sign_in_at,
    GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(u.last_sign_in_at, u.created_at)))::int,
    COALESCE(l.cnt, 0)::bigint,
    COALESCE(p.clicks_used, 0)::bigint,
    COALESCE(p.plan_slug, 'free')::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM public.links GROUP BY user_id) l ON l.user_id = u.id
  WHERE COALESCE(u.last_sign_in_at, u.created_at) < now() - interval '15 days'
  ORDER BY COALESCE(u.last_sign_in_at, u.created_at) ASC
  LIMIT 500;
$function$;
GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_dormant_users(_days integer DEFAULT 15)
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_login_at timestamptz,
  days_inactive integer,
  links_count bigint,
  total_clicks bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $function$
  SELECT
    u.id,
    COALESCE(p.email, u.email)::text,
    u.created_at,
    u.last_sign_in_at,
    GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(u.last_sign_in_at, u.created_at)))::int,
    COALESCE(l.cnt, 0)::bigint,
    COALESCE(l.clicks, 0)::bigint
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) cnt, COALESCE(SUM(clicks_count), 0) clicks
    FROM public.links GROUP BY user_id
  ) l ON l.user_id = u.id
  WHERE COALESCE(u.last_sign_in_at, u.created_at) < now() - make_interval(days => GREATEST(1, _days))
  ORDER BY COALESCE(u.last_sign_in_at, u.created_at) ASC
  LIMIT 1000;
$function$;
GRANT EXECUTE ON FUNCTION public.admin_get_dormant_users(integer) TO service_role;

-- ------------------------------------------------------------
-- 3. Reset all click counters (admin maintenance)
--    Lifetime rollups in click_dim_daily are intentionally kept.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  removed bigint;
BEGIN
  SELECT COUNT(*) INTO removed FROM public.clicks;
  TRUNCATE TABLE public.clicks;
  UPDATE public.links SET clicks_count = 0, bot_clicks_count = 0;
  UPDATE public.profiles SET clicks_used = 0;
  RETURN jsonb_build_object('ok', true, 'clicks_deleted', removed);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;

NOTIFY pgrst, 'reload schema';
