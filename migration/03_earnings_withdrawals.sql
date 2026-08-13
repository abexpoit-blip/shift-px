-- Adspx: free-for-all earning model + withdrawal system
-- Run on the VPS Postgres (self-hosted Supabase) once:
--   psql "$DATABASE_URL" -f migration/03_earnings_withdrawals.sql

-- 1) Payout settings on the singleton app_settings row
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS earning_rate_per_1k numeric NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS min_withdrawal_usd numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS payout_networks text[] NOT NULL DEFAULT ARRAY['USDT_TRC20', 'USDT_BEP20'];

-- 2) Balances + telegram handle on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance_available numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pending numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_withdrawn numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telegram text;

-- 3) Daily earnings ledger (one row per user per day)
CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  human_clicks integer NOT NULL DEFAULT 0,
  bot_clicks integer NOT NULL DEFAULT 0,
  earnings_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS earnings_ledger_user_day_idx ON public.earnings_ledger (user_id, day DESC);

GRANT SELECT ON public.earnings_ledger TO authenticated;
GRANT ALL ON public.earnings_ledger TO service_role;
ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own earnings readable" ON public.earnings_ledger;
CREATE POLICY "own earnings readable" ON public.earnings_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all earnings" ON public.earnings_ledger;
CREATE POLICY "admins read all earnings" ON public.earnings_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) Payout wallets
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network text NOT NULL,
  address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, network, address)
);
CREATE INDEX IF NOT EXISTS user_wallets_user_idx ON public.user_wallets (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own wallets" ON public.user_wallets;
CREATE POLICY "own wallets" ON public.user_wallets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd numeric NOT NULL CHECK (amount_usd > 0),
  network text NOT NULL,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON public.withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals (status, created_at DESC);

GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own withdrawals readable" ON public.withdrawals;
CREATE POLICY "own withdrawals readable" ON public.withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all withdrawals" ON public.withdrawals;
CREATE POLICY "admins read all withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) Recompute earnings from daily_stats (source of truth = verified human clicks)
CREATE OR REPLACE FUNCTION public.recompute_earnings(_days integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := (now() AT TIME ZONE 'UTC')::date - GREATEST(0, LEAST(COALESCE(_days, 3), 90));
  v_rate numeric := COALESCE((SELECT earning_rate_per_1k FROM public.app_settings LIMIT 1), 0.02);
  v_rows int := 0;
BEGIN
  WITH src AS (
    SELECT l.user_id,
           ds.day,
           SUM(ds.human_clicks)::int AS humans,
           SUM(ds.bot_clicks)::int AS bots
    FROM public.daily_stats ds
    JOIN public.links l ON l.id = ds.link_id
    WHERE ds.day >= v_from
    GROUP BY 1, 2
  )
  INSERT INTO public.earnings_ledger (user_id, day, human_clicks, bot_clicks, earnings_usd, updated_at)
  SELECT user_id, day, humans, bots, ROUND((humans::numeric / 1000) * v_rate, 6), now()
  FROM src
  ON CONFLICT (user_id, day) DO UPDATE
    SET human_clicks = EXCLUDED.human_clicks,
        bot_clicks = EXCLUDED.bot_clicks,
        earnings_usd = EXCLUDED.earnings_usd,
        updated_at = now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Refresh balances: lifetime earnings minus paid + pending withdrawals
  UPDATE public.profiles p
  SET balance_withdrawn = COALESCE(w.paid, 0),
      balance_pending = COALESCE(w.pending, 0),
      balance_available = GREATEST(COALESCE(e.total, 0) - COALESCE(w.paid, 0) - COALESCE(w.pending, 0), 0),
      updated_at = now()
  FROM (SELECT user_id, SUM(earnings_usd) AS total FROM public.earnings_ledger GROUP BY 1) e
  LEFT JOIN (
    SELECT user_id,
           SUM(amount_usd) FILTER (WHERE status = 'paid') AS paid,
           SUM(amount_usd) FILTER (WHERE status IN ('pending', 'approved')) AS pending
    FROM public.withdrawals GROUP BY 1
  ) w ON w.user_id = e.user_id
  WHERE p.id = e.user_id;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows, 'rate_per_1k', v_rate);
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_earnings(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_earnings(integer) TO service_role;

-- 7) Request a withdrawal atomically (balance check + hold)
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _network text, _address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_min numeric := COALESCE((SELECT min_withdrawal_usd FROM public.app_settings LIMIT 1), 10);
  v_available numeric;
  v_banned boolean;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF _amount IS NULL OR _amount < v_min THEN
    RETURN jsonb_build_object('ok', false, 'error', 'below_minimum', 'minimum', v_min);
  END IF;
  IF _address IS NULL OR length(btrim(_address)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_address');
  END IF;

  SELECT is_banned, balance_available INTO v_banned, v_available
  FROM public.profiles WHERE id = v_user FOR UPDATE;

  IF COALESCE(v_banned, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_suspended');
  END IF;
  IF COALESCE(v_available, 0) < _amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'available', COALESCE(v_available, 0));
  END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = v_user AND status IN ('pending', 'approved')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pending_request_exists');
  END IF;

  INSERT INTO public.withdrawals (user_id, amount_usd, network, wallet_address)
  VALUES (v_user, _amount, upper(btrim(_network)), btrim(_address))
  RETURNING id INTO v_id;

  UPDATE public.profiles
  SET balance_available = balance_available - _amount,
      balance_pending = balance_pending + _amount,
      updated_at = now()
  WHERE id = v_user;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) TO service_role;

-- 8) Admin settles a withdrawal (paid | rejected)
CREATE OR REPLACE FUNCTION public.settle_withdrawal(_id uuid, _status text, _tx_hash text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF _status NOT IN ('paid', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO v_row FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE public.withdrawals
  SET status = _status, tx_hash = _tx_hash, admin_note = _note,
      processed_by = auth.uid(), processed_at = now(), updated_at = now()
  WHERE id = _id;

  IF _status = 'paid' THEN
    UPDATE public.profiles
    SET balance_pending = GREATEST(balance_pending - v_row.amount_usd, 0),
        balance_withdrawn = balance_withdrawn + v_row.amount_usd,
        updated_at = now()
    WHERE id = v_row.user_id;
  ELSE
    UPDATE public.profiles
    SET balance_pending = GREATEST(balance_pending - v_row.amount_usd, 0),
        balance_available = balance_available + v_row.amount_usd,
        updated_at = now()
    WHERE id = v_row.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.settle_withdrawal(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_withdrawal(uuid, text, text, text) TO service_role;

-- 9) Everything is free: drop plan-based quotas
UPDATE public.profiles SET link_limit = NULL, click_quota = NULL;

-- 10) First backfill of the ledger (last 90 days)
SELECT public.recompute_earnings(90);
