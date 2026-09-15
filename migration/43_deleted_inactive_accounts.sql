-- ============================================================
-- 43 — Inactive User 14-Day Purge & Deletion Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deleted_inactive_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  user_id       uuid,
  reason        text NOT NULL DEFAULT 'inactive_14_days',
  deleted_at    timestamptz NOT NULL DEFAULT now(),
  days_inactive integer,
  message       text NOT NULL DEFAULT 'Your account has been deleted due to 14 days of inactivity (no login or traffic sent).'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_inactive_accounts_email
  ON public.deleted_inactive_accounts (LOWER(TRIM(email)));

CREATE INDEX IF NOT EXISTS idx_deleted_inactive_accounts_deleted_at
  ON public.deleted_inactive_accounts (deleted_at DESC);

ALTER TABLE public.deleted_inactive_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for inactive notice" ON public.deleted_inactive_accounts;
CREATE POLICY "Allow public read for inactive notice"
  ON public.deleted_inactive_accounts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service_role all" ON public.deleted_inactive_accounts;
CREATE POLICY "Allow service_role all"
  ON public.deleted_inactive_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.deleted_inactive_accounts TO anon, authenticated;
GRANT ALL ON public.deleted_inactive_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.check_deleted_inactive_account(_email text)
RETURNS TABLE (
  is_deleted boolean,
  message text,
  deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true AS is_deleted,
    d.message,
    d.deleted_at
  FROM public.deleted_inactive_accounts d
  WHERE LOWER(TRIM(d.email)) = LOWER(TRIM(_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      false AS is_deleted,
      NULL::text AS message,
      NULL::timestamptz AS deleted_at;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_deleted_inactive_account(text) TO anon, authenticated, service_role;
