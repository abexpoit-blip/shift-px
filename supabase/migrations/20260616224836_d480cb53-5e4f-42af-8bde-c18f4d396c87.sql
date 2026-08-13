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

  -- IMPORTANT: clicks_used is a MONOTONIC quota counter for ALL users
  -- (free + paid). It is ONLY incremented by record_redirect_click and
  -- MUST NEVER be recomputed from link counters, because reset_all_clicks
  -- zeros link counters and would otherwise wipe every user's quota usage,
  -- letting them exploit the reset by re-using their full quota.
  --
  -- This function now ONLY resyncs ours_clicks (display-only counter)
  -- for ALL users. It never touches clicks_used.

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(ours_clicks_count), 0)::bigint AS total_ours
    FROM public.links
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE public.profiles p
  SET ours_clicks = agg.total_ours
  FROM agg
  WHERE p.id = agg.user_id
    AND p.ours_clicks IS DISTINCT FROM agg.total_ours;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated_ours', v_updated, 'at', now());
END $function$;