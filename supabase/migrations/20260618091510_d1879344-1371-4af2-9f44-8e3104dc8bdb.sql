CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    NULLIF(e->>'link_id', '')::uuid,
    NULLIF(e->>'ip', ''),
    NULLIF(e->>'country', ''),
    NULLIF(e->>'ua', ''),
    COALESCE((e->>'is_bot')::boolean, false),
    NULLIF(e->>'bot_reason', ''),
    COALESCE(NULLIF(e->>'routed_to', ''), 'offer'),
    NULLIF(e->>'utm_source', ''),
    NULLIF(e->>'utm_medium', ''),
    NULLIF(e->>'utm_campaign', ''),
    NULLIF(e->>'utm_term', ''),
    NULLIF(e->>'utm_content', ''),
    NULLIF(e->>'referer_host', ''),
    COALESCE(NULLIF(e->>'bot_score', '')::integer, 0),
    COALESCE(e->'signals', '{}'::jsonb),
    COALESCE((e->>'challenge_passed')::boolean, false)
  FROM jsonb_array_elements(_events) AS e
  WHERE NULLIF(e->>'link_id', '') IS NOT NULL
  LIMIT 250;

  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT NULLIF(e->>'link_id', '')::uuid AS link_id, COUNT(*)::integer AS n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = true
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      NULLIF(e->>'link_id', '')::uuid AS link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'offer')::integer AS offer_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'link_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      NULLIF(e->>'user_id', '')::uuid AS user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(e->>'routed_to', ''), 'offer') = 'ours')::integer AS ours_n
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE((e->>'is_bot')::boolean, false) = false
      AND NULLIF(e->>'user_id', '') IS NOT NULL
    GROUP BY 1
  ) AS s
  WHERE p.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;