
ALTER TABLE public.upgrade_requests
  ADD COLUMN IF NOT EXISTS plisio_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS plisio_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS plisio_status TEXT;

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_plisio_invoice
  ON public.upgrade_requests (plisio_invoice_id);
