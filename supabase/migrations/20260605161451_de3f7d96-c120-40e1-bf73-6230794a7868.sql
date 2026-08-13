-- Rename columns in clicks to match code expectations
ALTER TABLE public.clicks RENAME COLUMN ip_address TO ip;
ALTER TABLE public.clicks RENAME COLUMN user_agent TO ua;

-- Add missing columns to upgrade_requests
ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT;

-- Add missing columns to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS click_quota INTEGER DEFAULT 50;

-- Fix cloaking_rules columns
ALTER TABLE public.cloaking_rules ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'safe';

-- Fix record_redirect_click to use correct column names after rename
CREATE OR REPLACE FUNCTION public.record_redirect_click(
  _link_id uuid,
  _user_id uuid,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _is_bot boolean DEFAULT false,
  _bot_reason text DEFAULT NULL,
  _routed_to text DEFAULT 'offer',
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_term text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _referer_host text DEFAULT NULL,
  _bot_score integer DEFAULT 0,
  _signals jsonb DEFAULT '{}'::jsonb,
  _challenge_passed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clicks (
    link_id,
    ip,
    country,
    ua,
    is_bot,
    bot_reason,
    routed_to,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referer_host,
    bot_score,
    signals,
    challenge_passed
  ) VALUES (
    _link_id,
    _ip,
    _country,
    _ua,
    _is_bot,
    _bot_reason,
    _routed_to,
    _utm_source,
    _utm_medium,
    _utm_campaign,
    _utm_term,
    _utm_content,
    _referer_host,
    _bot_score,
    _signals,
    _challenge_passed
  );

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
END;
$$;