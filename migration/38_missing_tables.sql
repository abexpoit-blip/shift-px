-- ============================================================
-- 38 — Tables the application queries but that were never created.
--      Missing ones caused "Internal Server Error" in the admin
--      control panel, link targeting and signup protection.
--      Safe to re-run.
-- ============================================================

-- ---------- Bot / cloaking rule engine ----------
CREATE TABLE IF NOT EXISTS public.bot_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type  text NOT NULL,                 -- ua | ip | asn | country
  pattern    text NOT NULL,
  label      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_rules_active_idx ON public.bot_rules (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.cloaking_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type  text NOT NULL,                 -- ua | ip | asn | country
  pattern    text NOT NULL,
  action     text NOT NULL DEFAULT 'safe',  -- safe | offer | block
  label      text,
  priority   integer NOT NULL DEFAULT 100,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cloaking_rules_prio_idx ON public.cloaking_rules (priority) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.referrer_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern     text NOT NULL,
  trust_score integer NOT NULL DEFAULT 50,
  action      text NOT NULL DEFAULT 'allow', -- allow | suspect | block
  label       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrer_rules_active_idx ON public.referrer_rules (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.bot_fingerprints (
  fingerprint_hash text PRIMARY KEY,
  hits             bigint  NOT NULL DEFAULT 0,
  auto_blocked     boolean NOT NULL DEFAULT false,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.country_tiers (
  country_code varchar(2) PRIMARY KEY,
  tier         smallint NOT NULL DEFAULT 3
);

-- ---------- Per-link targeting ----------
CREATE TABLE IF NOT EXISTS public.geo_offers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id       uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  tier          smallint,
  country_codes text[],
  offer_url     text NOT NULL,
  weight        integer NOT NULL DEFAULT 100,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geo_offers_link_idx ON public.geo_offers (link_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.ab_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id       uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  variant_label text NOT NULL,
  offer_url     text NOT NULL,
  weight_pct    integer NOT NULL DEFAULT 50,
  clicks        bigint  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, variant_label)
);
CREATE INDEX IF NOT EXISTS ab_variants_link_idx ON public.ab_variants (link_id) WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.increment_ab_variant_clicks(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $function$
  UPDATE public.ab_variants SET clicks = clicks + 1 WHERE id = _id;
$function$;

-- ---------- Signup protection ----------
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain     text PRIMARY KEY,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id         bigserial PRIMARY KEY,
  ip         text,
  email      text,
  success    boolean NOT NULL DEFAULT false,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_attempts_created_idx ON public.signup_attempts (created_at DESC);

-- ---------- Shortener domains ----------
CREATE TABLE IF NOT EXISTS public.shortener_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain     text NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shortener_domains (domain, is_primary, is_active)
VALUES ('adswapx.com', true, true)
ON CONFLICT (domain) DO NOTHING;

-- ---------- Grants + RLS ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bot_rules','cloaking_rules','referrer_rules','bot_fingerprints','country_tiers',
    'geo_offers','ab_variants','blocked_email_domains','signup_attempts','shortener_domains'
  ] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.signup_attempts_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ab_variant_clicks(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
