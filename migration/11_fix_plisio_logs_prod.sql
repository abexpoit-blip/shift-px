-- Run this DIRECTLY on production self-hosted Supabase (supabase.sleepox.com)
-- This fixes: "Could not find the table 'public.plisio_event_logs'"
-- which is silently breaking the Plisio webhook order-recovery path.

CREATE TABLE IF NOT EXISTS public.plisio_event_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id       text,
  order_number text,
  status       text,
  raw_body     jsonb,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plisio_logs_txn ON public.plisio_event_logs(txn_id);
CREATE INDEX IF NOT EXISTS idx_plisio_logs_order ON public.plisio_event_logs(order_number);
CREATE INDEX IF NOT EXISTS idx_plisio_logs_created ON public.plisio_event_logs(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.plisio_event_logs TO authenticated;
GRANT INSERT ON public.plisio_event_logs TO anon;
GRANT ALL    ON public.plisio_event_logs TO service_role;

ALTER TABLE public.plisio_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view logs" ON public.plisio_event_logs;
CREATE POLICY "Admins can view logs"
  ON public.plisio_event_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Allow webhook inserts" ON public.plisio_event_logs;
CREATE POLICY "Allow webhook inserts"
  ON public.plisio_event_logs FOR INSERT
  WITH CHECK (true);

-- Force PostgREST to reload schema cache so the table becomes visible immediately
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'plisio_event_logs ready' AS status, COUNT(*) AS rows FROM public.plisio_event_logs;
