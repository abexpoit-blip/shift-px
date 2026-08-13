DROP FUNCTION IF EXISTS public.admin_get_inactive_users();

CREATE FUNCTION public.admin_get_inactive_users()
 RETURNS TABLE(id uuid, email text, plan_slug text, created_at timestamptz, last_login_at timestamptz, clicks_used bigint, link_count integer, days_inactive integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.email,
    COALESCE(p.plan_slug, 'free')::text AS plan_slug,
    p.created_at,
    p.last_login_at,
    COALESCE(p.clicks_used, 0)::bigint AS clicks_used,
    (SELECT COUNT(*)::int FROM public.links l WHERE l.user_id = p.id) AS link_count,
    EXTRACT(DAY FROM now() - COALESCE(p.last_login_at, p.created_at))::int AS days_inactive
  FROM public.profiles p
  WHERE
    (p.last_login_at IS NOT NULL AND p.last_login_at < now() - interval '7 days')
    OR (p.last_login_at IS NULL AND p.created_at < now() - interval '7 days')
  ORDER BY COALESCE(p.last_login_at, p.created_at) ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO service_role, authenticated;