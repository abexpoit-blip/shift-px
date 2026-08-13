
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS last_click_reset_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_click_reset_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clicks_before bigint;
  v_now timestamptz := now();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL;

  UPDATE public.profiles
  SET clicks_used = 0,
      ours_clicks = 0,
      clicks_period_start = v_now;

  INSERT INTO public.app_settings (id, last_click_reset_at, updated_at)
  VALUES (true, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET last_click_reset_at = v_now, updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'cleared', v_clicks_before, 'reset_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;
