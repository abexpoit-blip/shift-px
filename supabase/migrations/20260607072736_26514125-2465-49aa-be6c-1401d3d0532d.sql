-- Function to expire old pending requests
CREATE OR REPLACE FUNCTION expire_old_upgrade_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.upgrade_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Since we can't easily set up a cron job without pg_cron (which might not be enabled),
-- we will also add a trigger to expire requests whenever a new request is inserted or when the table is queried (if possible).
-- Alternatively, we can just call this function from the server-side code which we already planned.

-- Let's also make sure revenue stats only count 'paid', 'completed', 'success', 'finished'
-- This is already handled in the code, but good to keep in mind.

-- Add an index on status and created_at if not exists to speed up the cleanup
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status_created_at ON public.upgrade_requests (status, created_at);
