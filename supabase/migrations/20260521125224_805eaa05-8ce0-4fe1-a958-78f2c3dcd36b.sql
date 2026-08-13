CREATE TABLE public.plisio_webhook_retry_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  txn_id TEXT,
  order_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plisio_retry_due
  ON public.plisio_webhook_retry_queue (status, next_attempt_at)
  WHERE status = 'queued';

CREATE INDEX idx_plisio_retry_txn ON public.plisio_webhook_retry_queue (txn_id);

ALTER TABLE public.plisio_webhook_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view plisio retry queue"
  ON public.plisio_webhook_retry_queue
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER plisio_retry_queue_updated_at
  BEFORE UPDATE ON public.plisio_webhook_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();