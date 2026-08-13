-- 1. Ensure profiles has last_sign_in_at tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Function to purge detailed clicks older than 7 days
-- Aggregate stats are already stored in 'links' (clicks_count, bot_clicks_count) 
-- and daily stats are usually derived from clicks. To keep daily charts "forever",
-- we should have a daily_stats table, but looking at the code, it calculates them on the fly.
-- To satisfy "daily charts kept forever", we'll implement a simple daily aggregation table.

CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.links(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    human_clicks INTEGER DEFAULT 0,
    bot_clicks INTEGER DEFAULT 0,
    UNIQUE(link_id, day)
);

CREATE OR REPLACE FUNCTION public.maintenance_purge_old_clicks()
RETURNS void AS $$
BEGIN
    -- First, ensure all clicks are backed up to daily_stats
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks)
    SELECT 
        link_id, 
        created_at::date as day,
        COUNT(*) FILTER (WHERE is_bot = false) as humans,
        COUNT(*) FILTER (WHERE is_bot = true) as bots
    FROM public.clicks
    WHERE created_at < (now() - interval '1 day')
    GROUP BY link_id, created_at::date
    ON CONFLICT (link_id, day) DO UPDATE SET
        human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks;

    -- Now delete detailed logs older than 7 days
    DELETE FROM public.clicks WHERE created_at < (now() - interval '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute to service_role for cron/edge functions
GRANT EXECUTE ON FUNCTION public.maintenance_purge_old_clicks() TO service_role;

-- 4. Admin function to find inactive users (joined > 7 days ago, 0 clicks, no recent login)
CREATE OR REPLACE FUNCTION public.admin_get_inactive_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    clicks_used BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.created_at, p.last_login_at, p.clicks_used
    FROM public.profiles p
    WHERE p.created_at < (now() - interval '7 days')
      AND (p.last_login_at IS NULL OR p.last_login_at < (now() - interval '7 days'))
      AND p.clicks_used = 0
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_get_inactive_users() TO service_role;
