
CREATE TABLE IF NOT EXISTS public.bot_whitelist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('ua','asn','ip','ref','combo')),
  pattern TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hit_count BIGINT NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_whitelist TO authenticated;
GRANT ALL ON public.bot_whitelist TO service_role;
ALTER TABLE public.bot_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bot_whitelist" ON public.bot_whitelist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_whitelist_hit(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bot_whitelist
  SET hit_count = hit_count + 1, last_hit_at = now()
  WHERE id = _id;
$$;
