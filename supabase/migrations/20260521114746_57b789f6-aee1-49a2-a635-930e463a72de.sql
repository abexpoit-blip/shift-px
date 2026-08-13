CREATE TABLE public.plisio_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upgrade_request_id uuid,
  txn_id text,
  order_number text,
  status text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plisio_webhook_logs_request ON public.plisio_webhook_logs(upgrade_request_id);
CREATE INDEX idx_plisio_webhook_logs_txn ON public.plisio_webhook_logs(txn_id);
CREATE INDEX idx_plisio_webhook_logs_created ON public.plisio_webhook_logs(created_at DESC);

ALTER TABLE public.plisio_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio webhook logs"
ON public.plisio_webhook_logs FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));