CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL::text,
  _country text DEFAULT NULL::text,
  _ua text DEFAULT NULL::text,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL::text,
  _routed_to text DEFAULT 'offer'::text,
  _utm_source text DEFAULT NULL::text,
  _utm_medium text DEFAULT NULL::text,
  _utm_campaign text DEFAULT NULL::text,
  _utm_term text DEFAULT NULL::text,
  _utm_content text DEFAULT NULL::text,
  _referer_host text DEFAULT NULL::text,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to, utm_source, utm_medium,
    utm_campaign, utm_term, utm_content, referer_host, bot_score, signals, challenge_passed
  ) VALUES (
    _link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, _utm_source, _utm_medium,
    _utm_campaign, _utm_term, _utm_content, _referer_host, _bot_score, _signals, _challenge_passed
  );

  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        ours_clicks_count = COALESCE(ours_clicks_count, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END),
        offer_clicks_count = COALESCE(offer_clicks_count, 0) + (CASE WHEN _routed_to = 'offer' THEN 1 ELSE 0 END),
        last_clicked_at = now()
    WHERE id = _link_id;

    IF _user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET clicks_used = COALESCE(clicks_used, 0) + 1,
          ours_clicks = COALESCE(ours_clicks, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END)
      WHERE id = _user_id;
    END IF;
  END IF;
END;
$function$;