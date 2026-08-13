REVOKE INSERT ON public.plisio_event_logs FROM anon, authenticated;

DROP POLICY IF EXISTS "Allow anon/auth inserts for webhooks" ON public.plisio_event_logs;
DROP POLICY IF EXISTS "Allow webhook inserts" ON public.plisio_event_logs;

CREATE POLICY "Service role inserts Plisio logs"
ON public.plisio_event_logs
FOR INSERT
TO service_role
WITH CHECK (true);