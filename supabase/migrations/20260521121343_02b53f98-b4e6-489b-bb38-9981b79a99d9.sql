UPDATE public.packages
SET click_limit = 1000000,
    features = (
      SELECT jsonb_agg(
        CASE
          WHEN value #>> '{}' = '10,000,000 clicks / month' THEN to_jsonb('1,000,000 clicks / month'::text)
          ELSE value
        END
      )
      FROM jsonb_array_elements(features) AS value
    )
WHERE slug = 'pro_monthly';