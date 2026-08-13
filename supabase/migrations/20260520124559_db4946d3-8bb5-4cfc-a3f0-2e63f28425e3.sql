
CREATE OR REPLACE FUNCTION public.clicks_breakdown(
  p_since timestamptz,
  p_link_id uuid,
  p_dim text
)
RETURNS TABLE(key text, total bigint, humans bigint, bots bigint)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_col text;
BEGIN
  v_col := CASE p_dim
    WHEN 'country' THEN 'country'
    WHEN 'device' THEN 'device'
    WHEN 'browser' THEN 'browser'
    WHEN 'os' THEN 'os'
    WHEN 'variant' THEN 'variant'
    WHEN 'utm_source' THEN 'utm_source'
    WHEN 'utm_medium' THEN 'utm_medium'
    WHEN 'utm_campaign' THEN 'utm_campaign'
    WHEN 'referer_host' THEN 'referer_host'
    ELSE NULL
  END;
  IF v_col IS NULL THEN
    RAISE EXCEPTION 'invalid dimension: %', p_dim;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT COALESCE(NULLIF(c.%I, ''), 'unknown')::text AS key,
           COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE NOT c.is_bot)::bigint AS humans,
           COUNT(*) FILTER (WHERE c.is_bot)::bigint AS bots
    FROM public.clicks c
    WHERE c.created_at >= $1
      AND c.link_id = $2
    GROUP BY 1
    ORDER BY total DESC
  $q$, v_col)
  USING p_since, p_link_id;
END;
$$;
