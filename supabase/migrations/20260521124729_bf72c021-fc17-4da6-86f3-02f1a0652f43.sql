CREATE TABLE IF NOT EXISTS public.plisio_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  request_id text NOT NULL,
  correlation_id text,
  status_code integer,
  outcome text NOT NULL DEFAULT 'info',
  upgrade_request_id uuid,
  user_id uuid,
  txn_id text,
  order_number text,
  plisio_status text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_created_at ON public.plisio_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_correlation ON public.plisio_activity_log (correlation_id);
CREATE INDEX IF NOT EXISTS idx_pal_request ON public.plisio_activity_log (request_id);
CREATE INDEX IF NOT EXISTS idx_pal_event_type ON public.plisio_activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_pal_outcome ON public.plisio_activity_log (outcome);

ALTER TABLE public.plisio_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio activity log"
ON public.plisio_activity_log
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));