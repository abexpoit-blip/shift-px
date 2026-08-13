CREATE OR REPLACE FUNCTION public.resync_profile_click_counters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (p.clicks_used IS DISTINCT FROM agg.total_clicks
         OR p.ours_clicks IS DISTINCT FROM agg.total_ours);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'at', now());
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('resync-profile-counters');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'resync-profile-counters',
  '*/15 * * * *',
  $$ SELECT public.resync_profile_click_counters(); $$
);