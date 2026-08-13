--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: link_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.link_status AS ENUM (
    'active',
    'paused',
    'expired'
);


--
-- Name: check_and_increment_user_clicks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_increment_user_clicks(p_user_id uuid) RETURNS TABLE(exceeded boolean, clicks_used bigint, click_quota bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, NULL::BIGINT;
    RETURN;
  END IF;

  -- Monthly auto-reset
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    UPDATE public.profiles
       SET clicks_used = 0, clicks_period_start = now()
     WHERE id = p_user_id;
    u := 0;
  END IF;

  -- Unlimited plan (NULL quota) → always allow, still track usage
  IF q IS NULL THEN
    UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, u + 1, NULL::BIGINT;
    RETURN;
  END IF;

  -- Over quota: do NOT increment further (saves writes), just report
  IF u >= q THEN
    RETURN QUERY SELECT TRUE, u, q;
    RETURN;
  END IF;

  UPDATE public.profiles SET clicks_used = clicks_used + 1 WHERE id = p_user_id;
  RETURN QUERY SELECT FALSE, u + 1, q;
END;
$$;


--
-- Name: clicks_breakdown(timestamp with time zone, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clicks_breakdown(p_since timestamp with time zone, p_link_id uuid, p_dim text) RETURNS TABLE(key text, total bigint, humans bigint, bots bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $_$
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
$_$;


--
-- Name: clicks_daily(timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clicks_daily(p_since timestamp with time zone, p_link_id uuid DEFAULT NULL::uuid) RETURNS TABLE(link_id uuid, day date, humans bigint, bots bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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


--
-- Name: decrement_link_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_link_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles SET links_used = GREATEST(links_used - 1, 0) WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;


--
-- Name: enforce_link_quota(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_link_quota() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_used INT;
  v_quota INT;
BEGIN
  SELECT links_used, link_quota INTO v_used, v_quota
  FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  IF v_quota IS NULL THEN
    RAISE EXCEPTION 'No active plan. Please upgrade to create links.';
  END IF;

  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'Link quota reached (%/%). Please upgrade your plan.', v_used, v_quota;
  END IF;

  UPDATE public.profiles SET links_used = links_used + 1 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;


--
-- Name: get_user_click_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_click_status(p_user_id uuid) RETURNS TABLE(click_quota bigint, clicks_used bigint, exceeded boolean, period_kind text, period_start timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  q BIGINT;
  u BIGINT;
  k TEXT;
  s TIMESTAMPTZ;
BEGIN
  SELECT p.click_quota, p.clicks_used, p.clicks_period_kind, p.clicks_period_start
    INTO q, u, k, s
    FROM public.profiles p WHERE p.id = p_user_id;

  -- Auto-reset monthly window if 30+ days old
  IF k = 'monthly' AND s < (now() - INTERVAL '30 days') THEN
    u := 0;
  END IF;

  RETURN QUERY SELECT q, u, (q IS NOT NULL AND u >= q), k, s;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan_slug, link_quota, links_used)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'free', 1, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
  SELECT private.has_role(_user_id, _role)
$$;


--
-- Name: increment_link_bot_clicks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_link_bot_clicks(p_link_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.links SET bot_clicks_count = bot_clicks_count + 1 WHERE id = p_link_id;
$$;


--
-- Name: increment_link_clicks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_link_clicks(p_link_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.links SET clicks_count = clicks_count + 1 WHERE id = p_link_id;
$$;


--
-- Name: sync_quota_on_plan_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_quota_on_plan_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_link_limit INT;
  v_click_limit BIGINT;
  v_period TEXT;
BEGIN
  IF NEW.plan_slug IS DISTINCT FROM OLD.plan_slug THEN
    SELECT link_limit, click_limit, billing_period
      INTO v_link_limit, v_click_limit, v_period
      FROM public.packages
      WHERE slug = NEW.plan_slug AND is_active = true;
    IF v_link_limit IS NOT NULL THEN
      NEW.link_quota := v_link_limit;
    END IF;
    NEW.click_quota := v_click_limit; -- NULL = unlimited
    NEW.clicks_used := 0;
    NEW.clicks_period_start := now();
    NEW.clicks_period_kind := COALESCE(NULLIF(v_period,'free'),'monthly');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_rotation_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_rotation_config (
    id integer DEFAULT 1 NOT NULL,
    login_ad_enabled boolean DEFAULT false NOT NULL,
    login_ad_url text,
    login_ads_per_day integer DEFAULT 2 NOT NULL,
    rotation_enabled boolean DEFAULT false NOT NULL,
    rotation_admin_url text,
    rotation_user_clicks integer DEFAULT 1000 NOT NULL,
    rotation_admin_clicks integer DEFAULT 100 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_rotation_config_singleton CHECK ((id = 1))
);


--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email text,
    action text NOT NULL,
    resource text,
    status text DEFAULT 'success'::text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bot_protection_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_protection_config (
    id integer DEFAULT 1 NOT NULL,
    ip_rate_limit_per_min integer DEFAULT 30 NOT NULL,
    ip_rate_limit_window_sec integer DEFAULT 60 NOT NULL,
    suspicious_action text DEFAULT 'safe_page'::text NOT NULL,
    block_threshold_score integer DEFAULT 60 NOT NULL,
    safe_page_message text DEFAULT 'This article is temporarily unavailable. Please check back later.'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    signal_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    soft_reasons text[] DEFAULT '{}'::text[] NOT NULL,
    inapp_browser_relief boolean DEFAULT true NOT NULL,
    CONSTRAINT bot_protection_config_action CHECK ((suspicious_action = ANY (ARRAY['block'::text, 'safe_page'::text, 'allow'::text]))),
    CONSTRAINT bot_protection_config_singleton CHECK ((id = 1))
);


--
-- Name: clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    ip_address text,
    country text,
    city text,
    device text,
    browser text,
    os text,
    is_bot boolean DEFAULT false NOT NULL,
    bot_reason text,
    user_agent text,
    referer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variant text DEFAULT 'wellness'::text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    referer_host text,
    bot_score integer,
    fingerprint_hash text,
    signals jsonb,
    challenge_passed boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.clicks REPLICA IDENTITY FULL;


--
-- Name: custom_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    domain text NOT NULL,
    status text DEFAULT 'action_required'::text NOT NULL,
    verification_token text DEFAULT ('sleepox_verify='::text || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
    dns_target text DEFAULT '185.158.133.1'::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    last_checked_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_domains_domain_format CHECK ((domain ~* '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'::text)),
    CONSTRAINT custom_domains_status_check CHECK ((status = ANY (ARRAY['action_required'::text, 'verifying'::text, 'setting_up'::text, 'ready'::text, 'active'::text, 'offline'::text, 'failed'::text])))
);


--
-- Name: domain_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    dns_ok boolean DEFAULT false NOT NULL,
    http_ok boolean DEFAULT false NOT NULL,
    http_status integer,
    dns_target_observed text,
    error text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: duplicate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.duplicate_clicks (
    ip text NOT NULL,
    link_id uuid NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    hit_count integer DEFAULT 1 NOT NULL
);


--
-- Name: fb_asn_blocklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_asn_blocklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asn integer,
    ip_cidr text,
    label text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fb_asn_blocklist_check CHECK (((asn IS NOT NULL) OR (ip_cidr IS NOT NULL)))
);


--
-- Name: link_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    url text NOT NULL,
    label text,
    weight integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT link_destinations_weight_check CHECK (((weight >= 0) AND (weight <= 1000)))
);


--
-- Name: link_device_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_device_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    device text NOT NULL,
    os text DEFAULT 'any'::text NOT NULL,
    adsterra_url text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT link_device_rules_device_check CHECK ((device = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text, 'any'::text])))
);


--
-- Name: link_geo_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_geo_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    country_code text NOT NULL,
    adsterra_url text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT link_geo_rules_country_code_check CHECK ((length(country_code) = 2))
);


--
-- Name: link_time_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_time_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    days_mask integer DEFAULT 127 NOT NULL,
    start_minute integer DEFAULT 0 NOT NULL,
    end_minute integer DEFAULT 1440 NOT NULL,
    action text DEFAULT 'cloak'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ltr_action_chk CHECK ((action = ANY (ARRAY['safe'::text, 'cloak'::text, 'pass'::text]))),
    CONSTRAINT ltr_days_chk CHECK (((days_mask >= 1) AND (days_mask <= 127))),
    CONSTRAINT ltr_priority_chk CHECK (((priority >= 0) AND (priority <= 10000))),
    CONSTRAINT ltr_window_chk CHECK ((((start_minute >= 0) AND (start_minute <= 1440)) AND ((end_minute >= 0) AND (end_minute <= 1440))))
);


--
-- Name: link_variant_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_variant_overrides (
    link_id uuid NOT NULL,
    variant_slug text NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: link_variant_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_variant_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    variant_slug text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    total_clicks integer DEFAULT 0 NOT NULL,
    human_clicks integer DEFAULT 0 NOT NULL,
    bot_clicks integer DEFAULT 0 NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    last_evaluated_at timestamp with time zone,
    paused_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    short_code text NOT NULL,
    destination_url text NOT NULL,
    title text,
    status public.link_status DEFAULT 'active'::public.link_status NOT NULL,
    clicks_count integer DEFAULT 0 NOT NULL,
    bot_clicks_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    targeting jsonb DEFAULT '{}'::jsonb NOT NULL,
    adsterra_direct_link text,
    duplicate_protection boolean DEFAULT true NOT NULL,
    duplicate_window_minutes integer DEFAULT 30 NOT NULL,
    health_score integer,
    health_updated_at timestamp with time zone,
    brand_logo_url text,
    brand_name text,
    brand_tagline text,
    brand_color text,
    CONSTRAINT links_duplicate_window_minutes_check CHECK (((duplicate_window_minutes >= 1) AND (duplicate_window_minutes <= 1440)))
);

ALTER TABLE ONLY public.links REPLICA IDENTITY FULL;


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    price_monthly numeric(10,2) DEFAULT 0 NOT NULL,
    link_limit integer DEFAULT 50,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    click_limit bigint,
    billing_period text DEFAULT 'monthly'::text NOT NULL,
    price_onetime numeric DEFAULT 0 NOT NULL,
    is_featured boolean DEFAULT false NOT NULL
);


--
-- Name: payment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_settings (
    id integer DEFAULT 1 NOT NULL,
    plisio_enabled boolean DEFAULT false NOT NULL,
    plisio_api_key text,
    plisio_webhook_secret text,
    payment_instructions text DEFAULT 'Crypto payments via Plisio coming soon. Contact admin for manual upgrade.'::text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT single_row CHECK ((id = 1))
);


--
-- Name: plisio_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plisio_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    request_id text NOT NULL,
    correlation_id text,
    status_code integer,
    outcome text DEFAULT 'info'::text NOT NULL,
    upgrade_request_id uuid,
    user_id uuid,
    txn_id text,
    order_number text,
    plisio_status text,
    message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plisio_webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plisio_webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upgrade_request_id uuid,
    txn_id text,
    order_number text,
    status text,
    signature_valid boolean DEFAULT false NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plisio_webhook_retry_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plisio_webhook_retry_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    txn_id text,
    order_number text,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 6 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone,
    last_error text,
    source text DEFAULT 'webhook'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prelander_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prelander_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    subtitle text DEFAULT ''::text NOT NULL,
    intro text DEFAULT ''::text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    outro text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    country_codes text[] DEFAULT '{}'::text[] NOT NULL,
    device text DEFAULT 'any'::text NOT NULL,
    CONSTRAINT prelander_variants_device_check CHECK ((device = ANY (ARRAY['any'::text, 'mobile'::text, 'desktop'::text, 'tablet'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    avatar_url text,
    plan_slug text DEFAULT 'free'::text NOT NULL,
    link_quota integer DEFAULT 1 NOT NULL,
    links_used integer DEFAULT 0 NOT NULL,
    is_banned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_ad_date date,
    ads_shown_today integer DEFAULT 0 NOT NULL,
    click_quota bigint,
    clicks_used bigint DEFAULT 0 NOT NULL,
    clicks_period_start timestamp with time zone DEFAULT now() NOT NULL,
    clicks_period_kind text DEFAULT 'monthly'::text NOT NULL
);


--
-- Name: referer_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referer_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host_pattern text NOT NULL,
    action text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referer_rules_action_check CHECK ((action = ANY (ARRAY['safe'::text, 'cloak'::text, 'pass'::text])))
);


--
-- Name: shared_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    ip_address text NOT NULL,
    label text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: upgrade_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upgrade_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    package_slug text NOT NULL,
    payment_method text DEFAULT 'manual'::text NOT NULL,
    transaction_ref text,
    amount numeric,
    note text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plisio_invoice_id text,
    plisio_invoice_url text,
    plisio_status text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_rotation_config ad_rotation_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_rotation_config
    ADD CONSTRAINT ad_rotation_config_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bot_protection_config bot_protection_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_protection_config
    ADD CONSTRAINT bot_protection_config_pkey PRIMARY KEY (id);


--
-- Name: clicks clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicks
    ADD CONSTRAINT clicks_pkey PRIMARY KEY (id);


--
-- Name: custom_domains custom_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_domains
    ADD CONSTRAINT custom_domains_pkey PRIMARY KEY (id);


--
-- Name: custom_domains custom_domains_user_domain_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_domains
    ADD CONSTRAINT custom_domains_user_domain_unique UNIQUE (user_id, domain);


--
-- Name: domain_health_checks domain_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_health_checks
    ADD CONSTRAINT domain_health_checks_pkey PRIMARY KEY (id);


--
-- Name: duplicate_clicks duplicate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duplicate_clicks
    ADD CONSTRAINT duplicate_clicks_pkey PRIMARY KEY (ip, link_id);


--
-- Name: fb_asn_blocklist fb_asn_blocklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_asn_blocklist
    ADD CONSTRAINT fb_asn_blocklist_pkey PRIMARY KEY (id);


--
-- Name: link_destinations link_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_destinations
    ADD CONSTRAINT link_destinations_pkey PRIMARY KEY (id);


--
-- Name: link_device_rules link_device_rules_link_id_device_os_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_device_rules
    ADD CONSTRAINT link_device_rules_link_id_device_os_key UNIQUE (link_id, device, os);


--
-- Name: link_device_rules link_device_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_device_rules
    ADD CONSTRAINT link_device_rules_pkey PRIMARY KEY (id);


--
-- Name: link_geo_rules link_geo_rules_link_id_country_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_geo_rules
    ADD CONSTRAINT link_geo_rules_link_id_country_code_key UNIQUE (link_id, country_code);


--
-- Name: link_geo_rules link_geo_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_geo_rules
    ADD CONSTRAINT link_geo_rules_pkey PRIMARY KEY (id);


--
-- Name: link_time_rules link_time_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_time_rules
    ADD CONSTRAINT link_time_rules_pkey PRIMARY KEY (id);


--
-- Name: link_variant_overrides link_variant_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_variant_overrides
    ADD CONSTRAINT link_variant_overrides_pkey PRIMARY KEY (link_id);


--
-- Name: link_variant_tests link_variant_tests_link_id_variant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_variant_tests
    ADD CONSTRAINT link_variant_tests_link_id_variant_slug_key UNIQUE (link_id, variant_slug);


--
-- Name: link_variant_tests link_variant_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_variant_tests
    ADD CONSTRAINT link_variant_tests_pkey PRIMARY KEY (id);


--
-- Name: links links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_pkey PRIMARY KEY (id);


--
-- Name: links links_short_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_short_code_key UNIQUE (short_code);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: packages packages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_slug_key UNIQUE (slug);


--
-- Name: payment_settings payment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_settings
    ADD CONSTRAINT payment_settings_pkey PRIMARY KEY (id);


--
-- Name: plisio_activity_log plisio_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plisio_activity_log
    ADD CONSTRAINT plisio_activity_log_pkey PRIMARY KEY (id);


--
-- Name: plisio_webhook_logs plisio_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plisio_webhook_logs
    ADD CONSTRAINT plisio_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: plisio_webhook_retry_queue plisio_webhook_retry_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plisio_webhook_retry_queue
    ADD CONSTRAINT plisio_webhook_retry_queue_pkey PRIMARY KEY (id);


--
-- Name: prelander_variants prelander_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prelander_variants
    ADD CONSTRAINT prelander_variants_pkey PRIMARY KEY (id);


--
-- Name: prelander_variants prelander_variants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prelander_variants
    ADD CONSTRAINT prelander_variants_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: referer_rules referer_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referer_rules
    ADD CONSTRAINT referer_rules_pkey PRIMARY KEY (id);


--
-- Name: shared_domains shared_domains_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_domains
    ADD CONSTRAINT shared_domains_domain_key UNIQUE (domain);


--
-- Name: shared_domains shared_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_domains
    ADD CONSTRAINT shared_domains_pkey PRIMARY KEY (id);


--
-- Name: upgrade_requests upgrade_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upgrade_requests
    ADD CONSTRAINT upgrade_requests_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: clicks_bot_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clicks_bot_score_idx ON public.clicks USING btree (bot_score) WHERE (bot_score IS NOT NULL);


--
-- Name: clicks_fp_hash_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clicks_fp_hash_recent_idx ON public.clicks USING btree (fingerprint_hash, created_at DESC) WHERE (fingerprint_hash IS NOT NULL);


--
-- Name: clicks_ip_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clicks_ip_created_idx ON public.clicks USING btree (ip_address, created_at DESC);


--
-- Name: clicks_link_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clicks_link_id_created_at_idx ON public.clicks USING btree (link_id, created_at DESC);


--
-- Name: clicks_utm_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clicks_utm_source_idx ON public.clicks USING btree (link_id, utm_source);


--
-- Name: idx_admin_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs USING btree (created_at DESC);


--
-- Name: idx_admin_audit_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_status ON public.admin_audit_logs USING btree (status);


--
-- Name: idx_admin_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_user_id ON public.admin_audit_logs USING btree (user_id);


--
-- Name: idx_clicks_bot_reason_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_bot_reason_pattern ON public.clicks USING btree (bot_reason text_pattern_ops) WHERE (bot_reason IS NOT NULL);


--
-- Name: idx_clicks_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_country ON public.clicks USING btree (country);


--
-- Name: idx_clicks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_created_at ON public.clicks USING btree (created_at DESC);


--
-- Name: idx_clicks_is_bot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_is_bot ON public.clicks USING btree (is_bot);


--
-- Name: idx_clicks_is_bot_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_is_bot_created_at ON public.clicks USING btree (is_bot, created_at DESC);


--
-- Name: idx_clicks_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_link_id ON public.clicks USING btree (link_id);


--
-- Name: idx_clicks_link_id_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_link_id_created ON public.clicks USING btree (link_id, created_at DESC);


--
-- Name: idx_clicks_link_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_link_id_created_at ON public.clicks USING btree (link_id, created_at DESC);


--
-- Name: idx_clicks_referer_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_referer_host ON public.clicks USING btree (referer_host) WHERE (referer_host IS NOT NULL);


--
-- Name: idx_clicks_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_variant ON public.clicks USING btree (variant);


--
-- Name: idx_clicks_verify_created_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clicks_verify_created_variant ON public.clicks USING btree (created_at DESC, variant) WHERE ((bot_reason ~~ 'verify:%'::text) AND (variant IS NOT NULL));


--
-- Name: idx_custom_domains_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_domains_status ON public.custom_domains USING btree (status);


--
-- Name: idx_custom_domains_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_domains_user_id ON public.custom_domains USING btree (user_id);


--
-- Name: idx_domain_health_domain_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domain_health_domain_time ON public.domain_health_checks USING btree (domain_id, checked_at DESC);


--
-- Name: idx_duplicate_clicks_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_duplicate_clicks_last_seen ON public.duplicate_clicks USING btree (last_seen);


--
-- Name: idx_fb_blocklist_asn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_blocklist_asn ON public.fb_asn_blocklist USING btree (asn) WHERE ((is_active = true) AND (asn IS NOT NULL));


--
-- Name: idx_fb_blocklist_cidr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_blocklist_cidr ON public.fb_asn_blocklist USING btree (ip_cidr) WHERE ((is_active = true) AND (ip_cidr IS NOT NULL));


--
-- Name: idx_link_device_rules_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_device_rules_link ON public.link_device_rules USING btree (link_id) WHERE (is_active = true);


--
-- Name: idx_link_geo_rules_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_geo_rules_link ON public.link_geo_rules USING btree (link_id) WHERE (is_active = true);


--
-- Name: idx_link_time_rules_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_time_rules_link ON public.link_time_rules USING btree (link_id, is_active, priority);


--
-- Name: idx_link_variant_overrides_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_variant_overrides_slug ON public.link_variant_overrides USING btree (variant_slug);


--
-- Name: idx_link_variant_tests_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_variant_tests_link ON public.link_variant_tests USING btree (link_id);


--
-- Name: idx_link_variant_tests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_variant_tests_status ON public.link_variant_tests USING btree (status);


--
-- Name: idx_links_health_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_health_score ON public.links USING btree (health_score DESC NULLS LAST);


--
-- Name: idx_links_short_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_short_code ON public.links USING btree (short_code);


--
-- Name: idx_links_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_status ON public.links USING btree (status);


--
-- Name: idx_links_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_user_id ON public.links USING btree (user_id);


--
-- Name: idx_links_user_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_user_id_created_at ON public.links USING btree (user_id, created_at DESC);


--
-- Name: idx_packages_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packages_active_sort ON public.packages USING btree (is_active, sort_order);


--
-- Name: idx_pal_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_correlation ON public.plisio_activity_log USING btree (correlation_id);


--
-- Name: idx_pal_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_created_at ON public.plisio_activity_log USING btree (created_at DESC);


--
-- Name: idx_pal_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_event_type ON public.plisio_activity_log USING btree (event_type);


--
-- Name: idx_pal_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_outcome ON public.plisio_activity_log USING btree (outcome);


--
-- Name: idx_pal_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_request ON public.plisio_activity_log USING btree (request_id);


--
-- Name: idx_plisio_retry_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plisio_retry_due ON public.plisio_webhook_retry_queue USING btree (status, next_attempt_at) WHERE (status = 'queued'::text);


--
-- Name: idx_plisio_retry_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plisio_retry_txn ON public.plisio_webhook_retry_queue USING btree (txn_id);


--
-- Name: idx_plisio_webhook_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plisio_webhook_logs_created ON public.plisio_webhook_logs USING btree (created_at DESC);


--
-- Name: idx_plisio_webhook_logs_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plisio_webhook_logs_request ON public.plisio_webhook_logs USING btree (upgrade_request_id);


--
-- Name: idx_plisio_webhook_logs_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plisio_webhook_logs_txn ON public.plisio_webhook_logs USING btree (txn_id);


--
-- Name: idx_prelander_variants_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prelander_variants_country ON public.prelander_variants USING gin (country_codes);


--
-- Name: idx_prelander_variants_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prelander_variants_device ON public.prelander_variants USING btree (device) WHERE (is_active = true);


--
-- Name: idx_prelander_variants_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prelander_variants_sort ON public.prelander_variants USING btree (sort_order);


--
-- Name: idx_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_created_at ON public.profiles USING btree (created_at DESC);


--
-- Name: idx_profiles_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email_trgm ON public.profiles USING gin (email extensions.gin_trgm_ops) WHERE (email IS NOT NULL);


--
-- Name: idx_profiles_full_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_full_name_trgm ON public.profiles USING gin (full_name extensions.gin_trgm_ops) WHERE (full_name IS NOT NULL);


--
-- Name: idx_profiles_is_banned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_is_banned ON public.profiles USING btree (is_banned) WHERE (is_banned = true);


--
-- Name: idx_referer_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referer_rules_active ON public.referer_rules USING btree (priority) WHERE (is_active = true);


--
-- Name: idx_shared_domains_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_domains_active ON public.shared_domains USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_upgrade_requests_plisio_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upgrade_requests_plisio_invoice ON public.upgrade_requests USING btree (plisio_invoice_id);


--
-- Name: idx_upgrade_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upgrade_requests_status ON public.upgrade_requests USING btree (status);


--
-- Name: idx_upgrade_requests_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upgrade_requests_status_created_at ON public.upgrade_requests USING btree (status, created_at DESC);


--
-- Name: idx_upgrade_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upgrade_requests_user ON public.upgrade_requests USING btree (user_id);


--
-- Name: link_destinations_link_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX link_destinations_link_id_idx ON public.link_destinations USING btree (link_id);


--
-- Name: link_variant_overrides link_variant_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER link_variant_overrides_updated_at BEFORE UPDATE ON public.link_variant_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: links links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER links_updated_at BEFORE UPDATE ON public.links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plisio_webhook_retry_queue plisio_retry_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plisio_retry_queue_updated_at BEFORE UPDATE ON public.plisio_webhook_retry_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: prelander_variants prelander_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prelander_variants_updated_at BEFORE UPDATE ON public.prelander_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shared_domains shared_domains_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shared_domains_updated_at BEFORE UPDATE ON public.shared_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: links trg_decrement_link_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_decrement_link_count AFTER DELETE ON public.links FOR EACH ROW EXECUTE FUNCTION public.decrement_link_count();


--
-- Name: links trg_enforce_link_quota; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_link_quota BEFORE INSERT ON public.links FOR EACH ROW EXECUTE FUNCTION public.enforce_link_quota();


--
-- Name: fb_asn_blocklist trg_fb_blocklist_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fb_blocklist_updated BEFORE UPDATE ON public.fb_asn_blocklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: link_device_rules trg_link_device_rules_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_link_device_rules_updated BEFORE UPDATE ON public.link_device_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: link_geo_rules trg_link_geo_rules_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_link_geo_rules_updated BEFORE UPDATE ON public.link_geo_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: referer_rules trg_referer_rules_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_referer_rules_updated BEFORE UPDATE ON public.referer_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles trg_sync_quota_on_plan_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_quota_on_plan_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_quota_on_plan_change();


--
-- Name: custom_domains update_custom_domains_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_domains_updated_at BEFORE UPDATE ON public.custom_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: link_destinations update_link_destinations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_link_destinations_updated_at BEFORE UPDATE ON public.link_destinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: link_variant_tests update_link_variant_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_link_variant_tests_updated_at BEFORE UPDATE ON public.link_variant_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: clicks clicks_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clicks
    ADD CONSTRAINT clicks_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: duplicate_clicks duplicate_clicks_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duplicate_clicks
    ADD CONSTRAINT duplicate_clicks_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: link_destinations link_destinations_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_destinations
    ADD CONSTRAINT link_destinations_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: link_device_rules link_device_rules_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_device_rules
    ADD CONSTRAINT link_device_rules_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: link_geo_rules link_geo_rules_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_geo_rules
    ADD CONSTRAINT link_geo_rules_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: links links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bot_protection_config Admins can read protection config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read protection config" ON public.bot_protection_config FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bot_protection_config Admins can update protection config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update protection config" ON public.bot_protection_config FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fb_asn_blocklist Admins delete FB blocklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete FB blocklist" ON public.fb_asn_blocklist FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_variant_overrides Admins delete overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete overrides" ON public.link_variant_overrides FOR DELETE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: referer_rules Admins delete referer rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete referer rules" ON public.referer_rules FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shared_domains Admins delete shared domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete shared domains" ON public.shared_domains FOR DELETE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: prelander_variants Admins delete variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete variants" ON public.prelander_variants FOR DELETE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fb_asn_blocklist Admins insert FB blocklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert FB blocklist" ON public.fb_asn_blocklist FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_variant_overrides Admins insert overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert overrides" ON public.link_variant_overrides FOR INSERT WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: referer_rules Admins insert referer rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert referer rules" ON public.referer_rules FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shared_domains Admins insert shared domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert shared domains" ON public.shared_domains FOR INSERT WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: prelander_variants Admins insert variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert variants" ON public.prelander_variants FOR INSERT WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: packages Admins manage packages delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage packages delete" ON public.packages FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: packages Admins manage packages insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage packages insert" ON public.packages FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: packages Admins manage packages update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage packages update" ON public.packages FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_rotation_config Admins read ad config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read ad config" ON public.ad_rotation_config FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fb_asn_blocklist Admins update FB blocklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update FB blocklist" ON public.fb_asn_blocklist FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ad_rotation_config Admins update ad config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update ad config" ON public.ad_rotation_config FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_variant_overrides Admins update overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update overrides" ON public.link_variant_overrides FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payment_settings Admins update payment settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update payment settings" ON public.payment_settings FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: referer_rules Admins update referer rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update referer rules" ON public.referer_rules FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shared_domains Admins update shared domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update shared domains" ON public.shared_domains FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: upgrade_requests Admins update upgrade requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update upgrade requests" ON public.upgrade_requests FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: prelander_variants Admins update variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update variants" ON public.prelander_variants FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fb_asn_blocklist Admins view FB blocklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view FB blocklist" ON public.fb_asn_blocklist FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: clicks Admins view all clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all clicks" ON public.clicks FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_destinations Admins view all destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all destinations" ON public.link_destinations FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_device_rules Admins view all device rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all device rules" ON public.link_device_rules FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: domain_health_checks Admins view all domain health; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all domain health" ON public.domain_health_checks FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_geo_rules Admins view all geo rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all geo rules" ON public.link_geo_rules FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: links Admins view all links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all links" ON public.links FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_variant_overrides Admins view all overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all overrides" ON public.link_variant_overrides FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: packages Admins view all packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all packages" ON public.packages FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shared_domains Admins view all shared domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all shared domains" ON public.shared_domains FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_time_rules Admins view all time rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all time rules" ON public.link_time_rules FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: upgrade_requests Admins view all upgrade requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all upgrade requests" ON public.upgrade_requests FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: link_variant_tests Admins view all variant tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all variant tests" ON public.link_variant_tests FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: prelander_variants Admins view all variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all variants" ON public.prelander_variants FOR SELECT USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_audit_logs Admins view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payment_settings Admins view payment settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plisio_activity_log Admins view plisio activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view plisio activity log" ON public.plisio_activity_log FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plisio_webhook_retry_queue Admins view plisio retry queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view plisio retry queue" ON public.plisio_webhook_retry_queue FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plisio_webhook_logs Admins view plisio webhook logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view plisio webhook logs" ON public.plisio_webhook_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: referer_rules Admins view referer rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view referer rules" ON public.referer_rules FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: packages Anyone can view active packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT USING ((is_active = true));


--
-- Name: prelander_variants Anyone can view active variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active variants" ON public.prelander_variants FOR SELECT USING ((is_active = true));


--
-- Name: shared_domains Auth users view active shared domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users view active shared domains" ON public.shared_domains FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: link_destinations Owners delete destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete destinations" ON public.link_destinations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_destinations.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_device_rules Owners delete device rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete device rules" ON public.link_device_rules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_device_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_geo_rules Owners delete geo rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete geo rules" ON public.link_geo_rules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_geo_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_time_rules Owners delete time rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete time rules" ON public.link_time_rules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_time_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_destinations Owners insert destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners insert destinations" ON public.link_destinations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_destinations.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_device_rules Owners insert device rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners insert device rules" ON public.link_device_rules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_device_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_geo_rules Owners insert geo rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners insert geo rules" ON public.link_geo_rules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_geo_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_time_rules Owners insert time rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners insert time rules" ON public.link_time_rules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_time_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_destinations Owners update destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update destinations" ON public.link_destinations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_destinations.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_device_rules Owners update device rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update device rules" ON public.link_device_rules FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_device_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_geo_rules Owners update geo rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update geo rules" ON public.link_geo_rules FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_geo_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_time_rules Owners update time rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update time rules" ON public.link_time_rules FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_time_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_destinations Owners view destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view destinations" ON public.link_destinations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_destinations.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_device_rules Owners view device rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view device rules" ON public.link_device_rules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_device_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: domain_health_checks Owners view domain health; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view domain health" ON public.domain_health_checks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.custom_domains d
  WHERE ((d.id = domain_health_checks.domain_id) AND (d.user_id = auth.uid())))));


--
-- Name: link_geo_rules Owners view geo rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view geo rules" ON public.link_geo_rules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_geo_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_variant_overrides Owners view own overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view own overrides" ON public.link_variant_overrides FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links
  WHERE ((links.id = link_variant_overrides.link_id) AND (links.user_id = auth.uid())))));


--
-- Name: link_time_rules Owners view time rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view time rules" ON public.link_time_rules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_time_rules.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: link_variant_tests Owners view variant tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view variant tests" ON public.link_variant_tests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links l
  WHERE ((l.id = link_variant_tests.link_id) AND (l.user_id = auth.uid())))));


--
-- Name: custom_domains Users create own custom domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create own custom domains" ON public.custom_domains FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: links Users create own links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create own links" ON public.links FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: upgrade_requests Users create own upgrade requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create own upgrade requests" ON public.upgrade_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: custom_domains Users delete own custom domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own custom domains" ON public.custom_domains FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: links Users delete own links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own links" ON public.links FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: custom_domains Users update own custom domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own custom domains" ON public.custom_domains FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: links Users update own links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own links" ON public.links FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: clicks Users view clicks on own links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view clicks on own links" ON public.clicks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.links
  WHERE ((links.id = clicks.link_id) AND (links.user_id = auth.uid())))));


--
-- Name: custom_domains Users view own custom domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own custom domains" ON public.custom_domains FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: links Users view own links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own links" ON public.links FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: upgrade_requests Users view own upgrade requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own upgrade requests" ON public.upgrade_requests FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: ad_rotation_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ad_rotation_config ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_protection_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_protection_config ENABLE ROW LEVEL SECURITY;

--
-- Name: clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: domain_health_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.domain_health_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: duplicate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.duplicate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_asn_blocklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_asn_blocklist ENABLE ROW LEVEL SECURITY;

--
-- Name: link_destinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_destinations ENABLE ROW LEVEL SECURITY;

--
-- Name: link_device_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_device_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: link_geo_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_geo_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: link_time_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_time_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: link_variant_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_variant_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: link_variant_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_variant_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

--
-- Name: packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: plisio_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plisio_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: plisio_webhook_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plisio_webhook_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: plisio_webhook_retry_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plisio_webhook_retry_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: prelander_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prelander_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: referer_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referer_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: upgrade_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


