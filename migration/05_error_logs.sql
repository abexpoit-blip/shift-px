-- =========================================================
-- 05 — Admin error / bug log
-- Captures runtime errors from redirect hot-path & server fns.
-- High-traffic friendly: capped, indexed, admin-only access.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,              -- 'redirect', 'server_fn', 'webhook', 'bot_detect', ...
  level       text NOT NULL DEFAULT 'error', -- 'error' | 'warn' | 'info'
  message     text NOT NULL,
  stack       text,
  context     jsonb,                      -- { code, ip, ua, country, linkId, ... }
  link_id     uuid,
  user_id     uuid,
  resolved    boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at_desc ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source          ON public.error_logs (source);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved        ON public.error_logs (resolved) WHERE resolved = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.error_logs_id_seq TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS el_admin_all ON public.error_logs;
CREATE POLICY el_admin_all ON public.error_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Auto-trim: keep last 10,000 rows. Triggered after every insert
-- but only acts when the table exceeds the cap (cheap most of the time).
CREATE OR REPLACE FUNCTION public.trim_error_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.error_logs;
  IF v_count > 10000 THEN
    DELETE FROM public.error_logs
    WHERE id IN (
      SELECT id FROM public.error_logs
      ORDER BY id ASC
      LIMIT (v_count - 10000)
    );
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_trim_error_logs ON public.error_logs;
CREATE TRIGGER trg_trim_error_logs
AFTER INSERT ON public.error_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.trim_error_logs();
