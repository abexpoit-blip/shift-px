-- 1) Plan-aware reset: clear analytics for all, but only reset clicks_used for FREE users
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_snapshot_count bigint;
  v_free_reset_count bigint;
  v_now timestamptz := now();
  v_reset_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Snapshot every profile BEFORE any change (audit + restore safety net)
  INSERT INTO public.quota_reset_snapshots (
    reset_id, reset_at, profile_id, email, plan_slug,
    click_quota, clicks_used, clicks_period_start, plan_expires_at
  )
  SELECT
    v_reset_id, v_now, id, email, plan_slug,
    click_quota, clicks_used, clicks_period_start, plan_expires_at
  FROM public.profiles;
  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;

  -- Clear raw analytics for everyone (keeps stats page fast)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Zero link counters for everyone (display only; quota lives on profiles.clicks_used)
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  -- Display ours_clicks resets for everyone too
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  -- *** QUOTA RESET RULE ***
  -- ONLY free users get clicks_used reset (their weekly free quota refills).
  -- Paid monthly users (starter/pro/etc) keep clicks_used so they cannot
  -- exploit the reset for unlimited usage within their billing month.
  -- lifetime / unlimited have NULL click_quota anyway, so it does not matter.
  UPDATE public.profiles
  SET clicks_used = 0,
      clicks_period_start = v_now
  WHERE COALESCE(plan_slug, 'free') = 'free';
  GET DIAGNOSTICS v_free_reset_count = ROW_COUNT;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE
  SET last_click_reset_at = v_now,
      updated_at = v_now
  WHERE public.app_settings.id = EXCLUDED.id;

  RETURN jsonb_build_object(
    'ok', true,
    'cleared', v_clicks_before,
    'reset_at', v_now,
    'reset_id', v_reset_id,
    'snapshotted_profiles', v_snapshot_count,
    'free_users_quota_reset', v_free_reset_count
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;

-- 2) Schedule it every Sunday at 00:00 UTC (= 06:00 Bangladesh)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old/conflicting schedules with the same name if any
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('weekly-reset-all-clicks', 'sunday-reset-all-clicks');

    PERFORM cron.schedule(
      'weekly-reset-all-clicks',
      '0 0 * * 0',
      $cron$ SELECT public.reset_all_clicks(); $cron$
    );
  END IF;
END $$;