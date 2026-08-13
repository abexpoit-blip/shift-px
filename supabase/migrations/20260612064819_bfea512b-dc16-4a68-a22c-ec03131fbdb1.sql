CREATE OR REPLACE FUNCTION public.get_last_hour_click_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'humans', COUNT(*) FILTER (WHERE is_bot = false),
    'bots', COUNT(*) FILTER (WHERE is_bot = true),
    'offer', COUNT(*) FILTER (WHERE routed_to = 'offer'),
    'fb_article', COUNT(*) FILTER (WHERE routed_to = 'fb-article'),
    'safe', COUNT(*) FILTER (WHERE routed_to = 'safe'),
    'ours', COUNT(*) FILTER (WHERE routed_to = 'ours'),
    'fb', COUNT(*) FILTER (WHERE routed_to = 'fb')
  )
  FROM public.clicks
  WHERE created_at >= now() - interval '1 hour';
$$;

GRANT EXECUTE ON FUNCTION public.get_last_hour_click_stats() TO service_role;