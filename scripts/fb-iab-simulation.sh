#!/usr/bin/env bash
# Post-deploy FB_IAB user simulation.
# Sends N realistic Facebook in-app browser hits + crawler/bot control hits,
# then queries the DB to compute pass/block rates per cohort.
#
# Usage (run on the VPS, already logged in):
#   ./scripts/fb-iab-simulation.sh                    # defaults: code=esrs7j, N=20
#   ./scripts/fb-iab-simulation.sh esrs7j 30
#   APP_URL=http://localhost:3000 ./scripts/fb-iab-simulation.sh esrs7j 50
#
# Env overrides: APP_URL, DB_CONT, DB_USER, DB_NAME

set -euo pipefail

SHORT="${1:-esrs7j}"
N="${2:-20}"
APP_URL="${APP_URL:-http://localhost:3000}"
DB_CONT="${DB_CONT:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

TAG="fbsim-$(date +%s)"  # unique utm_content marker for this run

# Realistic FB_IAB user agents (Android + iOS FB and Instagram in-app browsers)
UA_FB_ANDROID='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]'
UA_FB_IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21C62 [FBAN/FBIOS;FBAV/445.0.0.30.109;FBBV/553868764;FBDV/iPhone14,3;]'
UA_IG_ANDROID='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.30.110 Android'
UA_IG_IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21C62 Instagram 312.0.0.30.109'

# Control cohorts (should be BLOCKED)
UA_FB_CRAWLER='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_BOT='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
UA_CURL='curl/8.0.1'

FB_UAS=("$UA_FB_ANDROID" "$UA_FB_IOS" "$UA_IG_ANDROID" "$UA_IG_IOS")
BLOCK_UAS=("$UA_FB_CRAWLER" "$UA_BOT" "$UA_CURL")

hit() {
  local ua="$1" cohort="$2"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -A "$ua" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
    -H "Accept-Language: en-US,en;q=0.9" \
    -H "Accept-Encoding: gzip, deflate, br" \
    -H "Sec-Fetch-Dest: document" \
    -H "Sec-Fetch-Mode: navigate" \
    -H "Sec-Fetch-Site: cross-site" \
    "${APP_URL}/r/${SHORT}?utm_content=${TAG}-${cohort}" >/dev/null
}

echo "=== FB_IAB simulation: tag=${TAG} hits=${N} target=/r/${SHORT} ==="

echo "--- sending ${N} FB_IAB real-user hits ---"
for i in $(seq 1 "$N"); do
  ua="${FB_UAS[$((RANDOM % ${#FB_UAS[@]}))]}"
  hit "$ua" "fbiab" &
  # small jitter to look natural and avoid IP-rate-limit collapse
  if (( i % 5 == 0 )); then wait; sleep 0.3; fi
done
wait

echo "--- sending ${#BLOCK_UAS[@]} x 3 control bot/crawler hits ---"
for ua in "${BLOCK_UAS[@]}"; do
  for _ in 1 2 3; do hit "$ua" "block" & done
done
wait

echo "--- waiting 2s for DB writes ---"
sleep 2

echo ""
echo "=== RESULTS for tag=${TAG} ==="
docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
WITH run AS (
  SELECT
    CASE
      WHEN utm_content = '${TAG}-fbiab' THEN 'fbiab_real'
      WHEN utm_content = '${TAG}-block' THEN 'control_bot'
      ELSE 'other'
    END AS cohort,
    bot_score,
    challenge_passed,
    signals->>'source'  AS source,
    signals->'reasons'  AS reasons
  FROM clicks
  WHERE utm_content LIKE '${TAG}-%'
)
SELECT
  cohort,
  COUNT(*)                                   AS total,
  COUNT(*) FILTER (WHERE challenge_passed)   AS passed,
  COUNT(*) FILTER (WHERE NOT challenge_passed) AS blocked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE challenge_passed) / NULLIF(COUNT(*),0), 1) AS pass_pct,
  ROUND(AVG(bot_score)::numeric, 1)          AS avg_score
FROM run
GROUP BY cohort
ORDER BY cohort;

\echo ''
\echo '--- source breakdown ---'
SELECT cohort, source, COUNT(*) FROM (
  SELECT
    CASE
      WHEN utm_content = '${TAG}-fbiab' THEN 'fbiab_real'
      WHEN utm_content = '${TAG}-block' THEN 'control_bot'
    END AS cohort,
    signals->>'source' AS source
  FROM clicks WHERE utm_content LIKE '${TAG}-%'
) x
GROUP BY cohort, source
ORDER BY cohort, source;

\echo ''
\echo '--- top reasons ---'
SELECT cohort, reason, COUNT(*) FROM (
  SELECT
    CASE
      WHEN utm_content = '${TAG}-fbiab' THEN 'fbiab_real'
      WHEN utm_content = '${TAG}-block' THEN 'control_bot'
    END AS cohort,
    jsonb_array_elements_text(COALESCE(signals->'reasons','[]'::jsonb)) AS reason
  FROM clicks WHERE utm_content LIKE '${TAG}-%'
) x
GROUP BY cohort, reason
ORDER BY cohort, COUNT(*) DESC;
SQL

echo ""
echo "=== PASS CRITERIA ==="
echo "  fbiab_real:  pass_pct >= 90   (real FB users should NOT be blocked)"
echo "  control_bot: pass_pct <= 10   (crawlers MUST be blocked)"
echo "=== done ==="
