-- Ensure service_role has access to everything for server functions
GRANT ALL ON public.clicks TO service_role;
GRANT ALL ON public.links TO service_role;

-- Helper function to get absolute total counts bypassing RLS
CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_clicks', (SELECT count(*)::int FROM clicks WHERE is_bot = false),
        'total_bots', (SELECT count(*)::int FROM clicks WHERE is_bot = true),
        'total_ours', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'ours'),
        'total_offer', (SELECT count(*)::int FROM clicks WHERE is_bot = false AND routed_to = 'offer'),
        'today_clicks', (SELECT count(*)::int FROM clicks WHERE created_at >= CURRENT_DATE AND is_bot = false),
        'total_links', (SELECT count(*)::int FROM links),
        'active_links', (SELECT count(*)::int FROM links WHERE is_active = true)
    ) INTO result;
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;
