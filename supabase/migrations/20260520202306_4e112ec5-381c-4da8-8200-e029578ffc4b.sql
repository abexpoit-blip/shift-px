CREATE OR REPLACE FUNCTION public.increment_link_clicks(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links SET clicks_count = clicks_count + 1 WHERE id = p_link_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_link_bot_clicks(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links SET bot_clicks_count = bot_clicks_count + 1 WHERE id = p_link_id;
$$;

REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_link_bot_clicks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_link_bot_clicks(uuid) TO service_role;