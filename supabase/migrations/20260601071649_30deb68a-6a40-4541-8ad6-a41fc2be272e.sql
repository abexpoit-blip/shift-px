
-- Smart Prelanding A/B: per-link per-template impression tracking + least-served picker
CREATE TABLE IF NOT EXISTS public.prelanding_stats (
  link_id uuid NOT NULL,
  template text NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, template)
);

GRANT SELECT ON public.prelanding_stats TO authenticated;
GRANT ALL    ON public.prelanding_stats TO service_role;

ALTER TABLE public.prelanding_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_owner_s ON public.prelanding_stats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.user_id = auth.uid()));

CREATE POLICY ps_admin_s ON public.prelanding_stats
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Atomic: pick least-served template from a candidate set, increment its counter, return name.
CREATE OR REPLACE FUNCTION public.pick_prelanding_template(_link_id uuid, _candidates text[])
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick text;
BEGIN
  -- Seed any missing candidates at 0 impressions so the picker sees them.
  INSERT INTO public.prelanding_stats (link_id, template, impressions, last_used_at)
  SELECT _link_id, t, 0, now() - interval '1 year'
  FROM unnest(_candidates) AS t
  ON CONFLICT (link_id, template) DO NOTHING;

  -- Pick the least-served (ties broken by oldest last_used_at, then random).
  SELECT template INTO v_pick
  FROM public.prelanding_stats
  WHERE link_id = _link_id AND template = ANY(_candidates)
  ORDER BY impressions ASC, last_used_at ASC, random()
  LIMIT 1;

  IF v_pick IS NULL THEN
    v_pick := _candidates[1];
  END IF;

  UPDATE public.prelanding_stats
  SET impressions = impressions + 1, last_used_at = now()
  WHERE link_id = _link_id AND template = v_pick;

  RETURN v_pick;
END $$;

GRANT EXECUTE ON FUNCTION public.pick_prelanding_template(uuid, text[]) TO service_role;
