
-- 1. Rewrite reset_all_clicks: preserve quota for ALL users (free + paid)
CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  -- Wipe raw data (storage/pressure relief)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Reset link display counters
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  -- IMPORTANT: Do NOT reset clicks_used / clicks_period_start for ANY user.
  -- Quota usage must be preserved so free + monthly users can't exploit the reset.
  -- Only zero the display-only ours_clicks counter.
  UPDATE public.profiles
  SET ours_clicks = 0;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END $function$;

-- 2. New function: delete inactive free users (7+ days no login)
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

  -- Find free-plan users inactive for 7+ days
  -- (either last_login_at is null AND created 7+ days ago, OR last_login_at < 7 days ago)
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE COALESCE(plan_slug, 'free') = 'free'
    AND (
      (last_login_at IS NULL AND created_at < now() - interval '7 days')
      OR (last_login_at IS NOT NULL AND last_login_at < now() - interval '7 days')
    );

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0, 'at', now());
  END IF;

  -- Delete from auth.users; profiles + links + everything ON DELETE CASCADE follows
  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted_count, 'at', now());
END $function$;

GRANT EXECUTE ON FUNCTION public.delete_inactive_free_users() TO service_role;

-- 3. Weekly cron: Sunday 03:30 UTC (30 min after click reset)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'weekly-delete-inactive-free-users';

    PERFORM cron.schedule(
      'weekly-delete-inactive-free-users',
      '30 3 * * 0',
      $cron$ SELECT public.delete_inactive_free_users(); $cron$
    );
  END IF;
END $$;
