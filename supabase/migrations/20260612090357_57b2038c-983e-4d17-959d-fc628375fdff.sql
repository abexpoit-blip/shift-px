
CREATE OR REPLACE FUNCTION public.increment_link_click_counters(
  _link_id uuid,
  _is_bot boolean,
  _routed_to text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _is_bot THEN
    UPDATE public.links
    SET bot_clicks_count = COALESCE(bot_clicks_count, 0) + 1
    WHERE id = _link_id;
  ELSE
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        ours_clicks_count = COALESCE(ours_clicks_count, 0) + (CASE WHEN _routed_to = 'ours' THEN 1 ELSE 0 END),
        offer_clicks_count = COALESCE(offer_clicks_count, 0) + (CASE WHEN _routed_to = 'offer' THEN 1 ELSE 0 END),
        last_clicked_at = now()
    WHERE id = _link_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ab_variant_clicks(
  _link_id uuid,
  _variant_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ab_variants
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE link_id = _link_id AND variant_label = _variant_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_click_counters(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ab_variant_clicks(uuid, text) TO service_role;
