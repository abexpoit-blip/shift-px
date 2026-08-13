-- 30_adspx_monetisation_reroute.sql
-- Adspx monetisation re-route (idempotent, safe to re-run)
--   * 100 of every 1000 human clicks (10%) go to OUR Adsterra link
--   * new Adsterra direct link
--   * user earning rate: $1 per 50,000 human clicks  => $0.02 / 1k
--   * minimum withdrawal: $10
--   * rebuild earnings ledger + balances with the current rate

BEGIN;

UPDATE public.app_settings
SET our_adsterra_url    = 'https://holylocusturtle.com/qcun05ba52?key=627eae6ba72f008dc083888e50aa1c5f',
    injection_threshold = 900,   -- 900 user + 100 ours = 10% of all humans
    injection_count     = 100,
    earning_rate_per_1k = 0.02,  -- $1 / 50,000 clicks
    min_withdrawal_usd  = 10,
    updated_at          = now()
WHERE id = true;

COMMIT;

-- rebuild the last 90 days of earnings with the new rate
SELECT public.recompute_earnings(90);

-- verify
SELECT our_adsterra_url,
       injection_threshold,
       injection_count,
       ROUND(100.0 * injection_count / NULLIF(injection_threshold + injection_count, 0), 2) AS ours_pct,
       earning_rate_per_1k,
       min_withdrawal_usd
FROM public.app_settings;
