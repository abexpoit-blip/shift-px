
CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    cutoff timestamptz := now() - interval '7 days';
    err_cutoff timestamptz := now() - interval '30 days';
    deleted_count int;
BEGIN
    -- Allow long-running maintenance
    PERFORM set_config('statement_timeout', '0', true);
    PERFORM set_config('lock_timeout', '0', true);
    PERFORM set_config('idle_in_transaction_session_timeout', '0', true);

    -- 1) Aggregate past full days into daily_stats (only for days that still have raw rows being purged)
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT
        link_id,
        created_at::date AS day,
        COUNT(*) FILTER (WHERE is_bot = false) AS humans,
        COUNT(*) FILTER (WHERE is_bot = true) AS bots,
        COALESCE(
          (SELECT jsonb_object_agg(country, c)
             FROM (SELECT country, COUNT(*) c FROM public.clicks c2
                   WHERE c2.link_id = cl.link_id AND c2.created_at::date = cl.created_at::date AND c2.country IS NOT NULL
                   GROUP BY country) s), '{}'::jsonb),
        '{}'::jsonb
    FROM public.clicks cl
    WHERE created_at < cutoff
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks,
        country_breakdown = EXCLUDED.country_breakdown;

    -- 2) Batched delete to avoid long single-statement
    LOOP
        WITH del AS (
            SELECT ctid FROM public.clicks WHERE created_at < cutoff LIMIT 5000
        )
        DELETE FROM public.clicks c USING del WHERE c.ctid = del.ctid;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
    END LOOP;

    -- 3) Purge old error logs in batches too
    LOOP
        WITH del AS (
            SELECT ctid FROM public.error_logs WHERE created_at < err_cutoff LIMIT 5000
        )
        DELETE FROM public.error_logs e USING del WHERE e.ctid = del.ctid;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
    END LOOP;
END;
$function$;
