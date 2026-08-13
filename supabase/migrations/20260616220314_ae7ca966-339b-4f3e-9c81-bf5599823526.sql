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

  -- Wipe raw click data (storage/pressure relief)
  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  -- Reset link display counters only. Quota fields are intentionally untouched.
  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  -- IMPORTANT: Do NOT reset clicks_used / clicks_period_start for ANY user.
  -- Quota usage must be preserved so free + monthly users can't exploit the reset.
  -- Only zero the display-only ours_clicks counter.
  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE
  SET last_click_reset_at = v_now,
      updated_at = v_now
  WHERE public.app_settings.id = EXCLUDED.id;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END
$function$;