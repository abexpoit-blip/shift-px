CREATE TABLE public.plisio_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    txn_id TEXT,
    order_number TEXT,
    status TEXT,
    raw_body JSONB,
    processed_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT ON public.plisio_event_logs TO anon, authenticated;
GRANT ALL ON public.plisio_event_logs TO service_role;

ALTER TABLE public.plisio_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon/auth inserts for webhooks" ON public.plisio_event_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view logs" ON public.plisio_event_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);