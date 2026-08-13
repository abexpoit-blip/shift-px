#!/bin/bash
# OG tags verifier — run BEFORE deploy (or after) to make sure
# Facebook/Twitter/LinkedIn will get a valid preview.
#
# Usage:
#   ./scripts/verify-og-tags.sh                              # checks default sample URL
#   ./scripts/verify-og-tags.sh https://breezysocial.com/r/kgcpsn
#   ./scripts/verify-og-tags.sh https://breezysocial.com/r/kgcpsn https://sleepox.com
#
# Exit code 0 = all tags present (safe to deploy / boost)
# Exit code 1 = something missing (DO NOT boost yet)

set -u

# Default test URLs (override via CLI args)
DEFAULT_URLS=(
  "https://breezysocial.com/r/kgcpsn"
  "https://sleepox.com"
)

if [ "$#" -gt 0 ]; then
  URLS=("$@")
else
  URLS=("${DEFAULT_URLS[@]}")
fi

REQUIRED_TAGS=("og:url" "og:title" "og:description" "og:image")

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

OVERALL_FAIL=0

for URL in "${URLS[@]}"; do
  echo ""
  echo "======================================================"
  echo "🔍 Checking: $URL"
  echo "======================================================"

  # Fetch as Facebook bot
  RESPONSE=$(curl -sS -L -A "facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)" \
    -w "\n---HTTP_STATUS:%{http_code}---" \
    --max-time 15 \
    "$URL" 2>&1)

  HTTP_STATUS=$(echo "$RESPONSE" | grep -oP '(?<=---HTTP_STATUS:)\d+' | tail -1)
  BODY=$(echo "$RESPONSE" | sed 's/---HTTP_STATUS:.*---//')

  echo "HTTP Status: $HTTP_STATUS"

  if [ "$HTTP_STATUS" != "200" ]; then
    echo -e "${RED}❌ FAIL: Expected HTTP 200, got $HTTP_STATUS${NC}"
    echo -e "${RED}   Facebook will see this as a broken link.${NC}"
    OVERALL_FAIL=1
    continue
  fi

  echo -e "${GREEN}✅ HTTP 200 OK${NC}"
  echo ""
  echo "Checking required OG tags:"

  URL_FAIL=0
  for TAG in "${REQUIRED_TAGS[@]}"; do
    # Match <meta property="og:xxx" content="...">  (order-flexible)
    VALUE=$(echo "$BODY" | grep -oiE "<meta[^>]*property=[\"']${TAG}[\"'][^>]*content=[\"'][^\"']*[\"']" | head -1 | grep -oiE "content=[\"'][^\"']*[\"']" | sed -E 's/content=["'"'"']([^"'"'"']*)["'"'"']/\1/')

    # Try reverse order: content first, property second
    if [ -z "$VALUE" ]; then
      VALUE=$(echo "$BODY" | grep -oiE "<meta[^>]*content=[\"'][^\"']*[\"'][^>]*property=[\"']${TAG}[\"']" | head -1 | grep -oiE "content=[\"'][^\"']*[\"']" | sed -E 's/content=["'"'"']([^"'"'"']*)["'"'"']/\1/')
    fi

    if [ -z "$VALUE" ]; then
      echo -e "  ${RED}❌ $TAG — MISSING${NC}"
      URL_FAIL=1
    else
      # Truncate long values for display
      DISPLAY="$VALUE"
      if [ ${#DISPLAY} -gt 80 ]; then
        DISPLAY="${DISPLAY:0:77}..."
      fi
      echo -e "  ${GREEN}✅ $TAG${NC} → $DISPLAY"
    fi
  done

  if [ $URL_FAIL -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ This URL is NOT safe to boost on Facebook.${NC}"
    OVERALL_FAIL=1
  else
    echo ""
    echo -e "${GREEN}✅ All required OG tags present — safe to boost.${NC}"
  fi
done

echo ""
echo "======================================================"
if [ $OVERALL_FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL CHECKS PASSED — Safe to deploy / boost${NC}"
  exit 0
else
  echo -e "${RED}🚨 SOME CHECKS FAILED — Fix before deploying / boosting${NC}"
  echo -e "${YELLOW}💡 Tip: After fixing, also run Facebook Debugger 'Scrape Again':${NC}"
  echo "   https://developers.facebook.com/tools/debug/"
  exit 1
fi
