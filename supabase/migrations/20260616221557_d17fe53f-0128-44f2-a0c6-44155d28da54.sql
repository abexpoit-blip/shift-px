-- ===== C3 fix: resync only free users, protect paid quotas =====
CREATE OR REPLACE FUNCTION public.resync_profile_click_counters()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated int;
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(clicks_count), 0)::bigint        AS total_clicks,
           COALESCE(SUM(ours_clicks_count), 0)::bigint   AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET clicks_used = agg.total_clicks,
      ours_clicks = agg.total_ours
  FROM agg
  WHERE p.id = agg.user_id
    -- IMPORTANT: only resync free-tier users. Paid users' clicks_used is a
    -- monthly quota counter that must NOT be overwritten by raw link sums
    -- (especially after reset_all_clicks zeros link counters).
    AND COALESCE(p.plan_slug, 'free') = 'free'
    AND (p.clicks_used IS DISTINCT FROM agg.total_clicks
         OR p.ours_clicks IS DISTINCT FROM agg.total_ours);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Always resync ours_clicks (display-only) for ALL users, since this is
  -- shown in the UI and is safe to recompute.
  WITH agg2 AS (
    SELECT user_id,
           COALESCE(SUM(ours_clicks_count), 0)::bigint AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET ours_clicks = agg2.total_ours
  FROM agg2
  WHERE p.id = agg2.user_id
    AND p.ours_clicks IS DISTINCT FROM agg2.total_ours
    AND COALESCE(p.plan_slug, 'free') != 'free';

  RETURN jsonb_build_object('ok', true, 'updated_free', v_updated, 'at', now());
END $function$;

-- ===== H4 fix: safer inactive user cleanup =====
CREATE OR REPLACE FUNCTION public.delete_inactive_free_users()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count int := 0;
  v_user_ids uuid[];
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  -- Find FREE-plan users inactive for 30+ days who have NO links and NO clicks.
  -- This is much safer than the previous 7-day threshold which deleted users
  -- before they had a chance to come back and configure their links.
  SELECT array_agg(p.id) INTO v_user_ids
  FROM public.profiles p
  WHERE COALESCE(p.plan_slug, 'free') = 'free'
    AND (
      -- Logged in but inactive 30+ days
      (p.last_login_at IS NOT NULL AND p.last_login_at < now() - interval '30 days')
      -- OR never logged in AND account is 30+ days old
      OR (p.last_login_at IS NULL AND p.created_at < now() - interval '30 days')
    )
    -- AND has NO links
    AND NOT EXISTS (SELECT 1 FROM public.links l WHERE l.user_id = p.id)
    -- AND has never been clicked through (zero clicks_used)
    AND COALESCE(p.clicks_used, 0) = 0;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0, 'at', now());
  END IF;

  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted_count, 'at', now());
END $function$;