CREATE TABLE IF NOT EXISTS public.quota_reset_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_id uuid NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  email text,
  plan_slug text,
  click_quota bigint,
  clicks_used bigint,
  clicks_period_start timestamptz,
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.quota_reset_snapshots TO service_role;

ALTER TABLE public.quota_reset_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS quota_reset_snapshots_reset_id_idx
  ON public.quota_reset_snapshots (reset_id, profile_id);

CREATE INDEX IF NOT EXISTS quota_reset_snapshots_profile_id_idx
  ON public.quota_reset_snapshots (profile_id, reset_at DESC);

CREATE OR REPLACE FUNCTION public.reset_all_clicks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clicks_before bigint;
  v_snapshot_count bigint;
  v_now timestamptz := now();
  v_reset_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);

  SELECT COUNT(*) INTO v_clicks_before FROM public.clicks;

  INSERT INTO public.quota_reset_snapshots (
    reset_id,
    reset_at,
    profile_id,
    email,
    plan_slug,
    click_quota,
    clicks_used,
    clicks_period_start,
    plan_expires_at
  )
  SELECT
    v_reset_id,
    v_now,
    id,
    email,
    plan_slug,
    click_quota,
    clicks_used,
    clicks_period_start,
    plan_expires_at
  FROM public.profiles;
  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;

  TRUNCATE TABLE public.clicks;
  TRUNCATE TABLE public.daily_stats;

  UPDATE public.links
  SET clicks_count = 0,
      bot_clicks_count = 0,
      ours_clicks_count = 0,
      offer_clicks_count = 0,
      last_clicked_at = NULL
  WHERE id IS NOT NULL;

  UPDATE public.profiles
  SET ours_clicks = 0
  WHERE id IS NOT NULL;

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
    'snapshotted_profiles', v_snapshot_count
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.restore_paid_quota_from_reset_snapshot(_reset_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset_id uuid;
  v_restored int;
BEGIN
  SELECT COALESCE(
    _reset_id,
    (SELECT reset_id FROM public.quota_reset_snapshots ORDER BY reset_at DESC LIMIT 1)
  ) INTO v_reset_id;

  IF v_reset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_snapshot_found');
  END IF;

  UPDATE public.profiles p
  SET clicks_used = GREATEST(COALESCE(p.clicks_used, 0), COALESCE(s.clicks_used, 0)),
      clicks_period_start = COALESCE(s.clicks_period_start, p.clicks_period_start)
  FROM public.quota_reset_snapshots s
  WHERE s.reset_id = v_reset_id
    AND s.profile_id = p.id
    AND COALESCE(s.plan_slug, 'free') <> 'free'
    AND COALESCE(s.clicks_used, 0) > COALESCE(p.clicks_used, 0);

  GET DIAGNOSTICS v_restored = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'reset_id', v_reset_id, 'restored', v_restored);
END
$function$;

GRANT EXECUTE ON FUNCTION public.reset_all_clicks() TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_paid_quota_from_reset_snapshot(uuid) TO service_role;