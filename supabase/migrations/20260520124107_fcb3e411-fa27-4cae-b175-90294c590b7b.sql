
CREATE OR REPLACE FUNCTION public.clicks_daily(p_since timestamptz, p_link_id uuid DEFAULT NULL)
RETURNS TABLE(link_id uuid, day date, humans bigint, bots bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.link_id,
         (c.created_at AT TIME ZONE 'UTC')::date AS day,
         COUNT(*) FILTER (WHERE NOT c.is_bot) AS humans,
         COUNT(*) FILTER (WHERE c.is_bot) AS bots
  FROM public.clicks c
  WHERE c.created_at >= p_since
    AND (p_link_id IS NULL OR c.link_id = p_link_id)
  GROUP BY c.link_id, day;
$$;

GRANT EXECUTE ON FUNCTION public.clicks_daily(timestamptz, uuid) TO authenticated;
