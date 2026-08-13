
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  resource text,
  status text NOT NULL DEFAULT 'success',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_user_id ON public.admin_audit_logs (user_id);
CREATE INDEX idx_admin_audit_logs_status ON public.admin_audit_logs (status);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
