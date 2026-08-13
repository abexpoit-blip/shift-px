-- Normalize legacy Plisio webhook statuses so revenue dashboards
-- (which filter by status='paid') include all crypto payments.
-- "completed" and "mismatch" both mean money received → mark as "paid".

UPDATE public.upgrade_requests
SET status = 'paid',
    updated_at = now()
WHERE status IN ('completed', 'mismatch');

-- Verification
SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total_usd
FROM public.upgrade_requests
GROUP BY status
ORDER BY status;
