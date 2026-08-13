-- M9 fix: recovery query in plisio-webhook.ts does WHERE txn_id = $1 on every unmatched webhook.
-- Without this index it becomes a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_plisio_event_logs_txn_id
  ON public.plisio_event_logs (txn_id);
