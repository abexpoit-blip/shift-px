
-- Fast click recorder RPC (replaces slow fallback path)
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text,
  _country text,
  _ua text,
  _is_bot boolean,
  _bot_reason text,
  _routed_to text,
  _utm_source text,
  _utm_medium text,
  _utm_campaign text,
  _utm_term text,
  _utm_content text,
  _referer_host text,
  _bot_score integer,
  _signals jsonb,
  _challenge_passed boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (link_id, ip, country, ua, is_bot, bot_reason, routed_to, challenge_passed)
  VALUES (_link_id, _ip, _country, _ua, _is_bot, _bot_reason, _routed_to, COALESCE(_challenge_passed, false));

  IF _is_bot THEN
    UPDATE public.links
       SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
     WHERE id = _link_id;
  ELSE
    UPDATE public.links
       SET clicks_count = COALESCE(clicks_count, 0) + 1
     WHERE id = _link_id;
    UPDATE public.profiles
       SET clicks_used = COALESCE(clicks_used, 0) + 1
     WHERE id = _user_id;
  END IF;
END $$;

-- Speed up the daily-1-ad-per-visitor lookup
CREATE INDEX IF NOT EXISTS idx_clicks_fp_routed_created
  ON public.clicks (fingerprint_hash, routed_to, created_at DESC);

-- Speed up generic per-link recent-click scans
CREATE INDEX IF NOT EXISTS idx_clicks_link_created
  ON public.clicks (link_id, created_at DESC);
