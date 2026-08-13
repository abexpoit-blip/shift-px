-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Update daily_stats to hold more granular data for long-term retention
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS country_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.daily_stats ADD COLUMN IF NOT EXISTS device_breakdown JSONB DEFAULT '{}'::jsonb;

-- Improved function to aggregate and purge
CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
RETURNS void AS $$
DECLARE
    purge_date DATE := (now() - interval '7 days')::date;
BEGIN
    -- 1. Aggregate stats for all days that will be purged or are missing
    -- We process everything up to yesterday to ensure data is finalized
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT 
        link_id, 
        created_at::date as day,
        COUNT(*) FILTER (WHERE is_bot = false) as humans,
        COUNT(*) FILTER (WHERE is_bot = true) as bots,
        jsonb_object_agg(country, count_val) FILTER (WHERE country IS NOT NULL) as countries,
        jsonb_object_agg(device, count_device) FILTER (WHERE device IS NOT NULL) as devices
    FROM (
        SELECT 
            link_id, 
            created_at::date,
            is_bot,
            country,
            COUNT(*) OVER(PARTITION BY link_id, created_at::date, country) as count_val,
            device,
            COUNT(*) OVER(PARTITION BY link_id, created_at::date, device) as count_device
        FROM public.clicks
        WHERE created_at < now()::date -- Only aggregate past days
    ) sub
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks,
        country_breakdown = EXCLUDED.country_breakdown,
        device_breakdown = EXCLUDED.device_breakdown;

    -- 2. Delete detailed logs older than 7 days
    DELETE FROM public.clicks WHERE created_at < (now() - interval '7 days');
    
    -- 3. Also purge old error logs while we are at it (older than 30 days)
    DELETE FROM public.error_logs WHERE created_at < (now() - interval '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job: Every Sunday at 00:00 UTC
-- Note: We use 'cron.schedule' which is standard for pg_cron
-- We wrap in a DO block to avoid duplicate scheduling if migration runs twice
DO $$
BEGIN
    -- Unschedule existing if any to avoid duplicates
    PERFORM cron.unschedule('weekly-click-purge');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END;
$$;

SELECT cron.schedule('weekly-click-purge', '0 0 * * 0', 'SELECT public.maintenance_purge_old_clicks()');

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
