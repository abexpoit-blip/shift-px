
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon text NOT NULL DEFAULT 'sparkles',
  tone text NOT NULL DEFAULT 'premium' CHECK (tone IN ('info','success','warning','premium')),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcasts_active_idx ON public.broadcasts (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS broadcast_reads_user_idx ON public.broadcast_reads (user_id);

GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
GRANT SELECT, INSERT, DELETE ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS b_read_active ON public.broadcasts;
CREATE POLICY b_read_active ON public.broadcasts FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS b_admin_all ON public.broadcasts;
CREATE POLICY b_admin_all ON public.broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS br_own_s ON public.broadcast_reads;
CREATE POLICY br_own_s ON public.broadcast_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS br_own_i ON public.broadcast_reads;
CREATE POLICY br_own_i ON public.broadcast_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS br_own_d ON public.broadcast_reads;
CREATE POLICY br_own_d ON public.broadcast_reads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
