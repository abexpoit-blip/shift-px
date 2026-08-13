DROP FUNCTION IF EXISTS public.admin_get_inactive_users();

CREATE OR REPLACE FUNCTION public.admin_get_inactive_users()
RETURNS TABLE(
  id uuid,
  email text,
  plan_slug text,
  clicks_used integer,
  link_count bigint,
  last_sign_in_at timestamptz,
  days_inactive integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    COALESCE(p.plan_slug, 'free') AS plan_slug,
    COALESCE(p.clicks_used, 0) AS clicks_used,
    (SELECT COUNT(*) FROM public.links l WHERE l.user_id = p.id) AS link_count,
    u.last_sign_in_at,
    GREATEST(0, EXTRACT(DAY FROM (now() - COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at)))::int) AS days_inactive,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(p.plan_slug, 'free') = 'free'
    AND COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at) < now() - interval '7 days'
  ORDER BY COALESCE(u.last_sign_in_at, p.last_login_at, p.created_at) ASC NULLS FIRST;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO authenticated, service_role;