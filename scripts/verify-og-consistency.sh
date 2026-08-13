#!/bin/bash
# Quick OG consistency check — verify og:url, canonical, twitter:url, og:image
# all match the public domain on a single short code, on every SHORT_DOMAIN.
#
# Usage:
#   ./scripts/verify-og-consistency.sh kgcpsn
#   ./scripts/verify-og-consistency.sh kgcpsn breezysocial.com sleepox.com
#
# Exit 0 = all consistent. Exit 1 = mismatch (DO NOT boost).

set -u
CODE="${1:-}"
if [ -z "$CODE" ]; then
  echo "Usage: $0 <short_code> [domain ...]"
  exit 2
fi
shift || true

if [ "$#" -gt 0 ]; then
  DOMAINS=("$@")
else
  DOMAINS=("breezysocial.com" "sleepox.com")
fi

UA="facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
FAIL=0

for D in "${DOMAINS[@]}"; do
  echo ""
  echo "==== $D /r/$CODE ===="
  EXPECTED="https://$D/$CODE"
  BODY=$(curl -sS -L -A "$UA" --max-time 15 "https://$D/r/$CODE")

  OG_URL=$(echo "$BODY" | grep -ioE '<meta[^>]+property=["'"'"']og:url["'"'"'][^>]+content=["'"'"'][^"'"'"']*["'"'"']' | head -1 | sed -E 's/.*content=["'"'"']([^"'"'"']*)["'"'"'].*/\1/')
  CANON=$(echo "$BODY" | grep -ioE '<link[^>]+rel=["'"'"']canonical["'"'"'][^>]+href=["'"'"'][^"'"'"']*["'"'"']' | head -1 | sed -E 's/.*href=["'"'"']([^"'"'"']*)["'"'"'].*/\1/')
  TW_URL=$(echo "$BODY" | grep -ioE '<meta[^>]+name=["'"'"']twitter:url["'"'"'][^>]+content=["'"'"'][^"'"'"']*["'"'"']' | head -1 | sed -E 's/.*content=["'"'"']([^"'"'"']*)["'"'"'].*/\1/')
  OG_IMG=$(echo "$BODY" | grep -ioE '<meta[^>]+property=["'"'"']og:image["'"'"'][^>]+content=["'"'"'][^"'"'"']*["'"'"']' | head -1 | sed -E 's/.*content=["'"'"']([^"'"'"']*)["'"'"'].*/\1/')

  check() {
    local label="$1" actual="$2" expected="$3"
    if [ "$actual" = "$expected" ]; then
      echo -e "  ${GREEN}✅ $label${NC} = $actual"
    else
      echo -e "  ${RED}❌ $label${NC} = '$actual'  (expected '$expected')"
      FAIL=1
    fi
  }
  check "og:url     " "$OG_URL" "$EXPECTED"
  check "canonical  " "$CANON"  "$EXPECTED"
  check "twitter:url" "$TW_URL" "$EXPECTED"
  if [ -z "$OG_IMG" ]; then
    echo -e "  ${RED}❌ og:image   MISSING${NC}"; FAIL=1
  elif [[ "$OG_IMG" != https://* ]]; then
    echo -e "  ${RED}❌ og:image   not absolute https: $OG_IMG${NC}"; FAIL=1
  else
    echo -e "  ${GREEN}✅ og:image  ${NC} = $OG_IMG"
  fi
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All domains consistent — safe to boost.${NC}"
  exit 0
else
  echo -e "${RED}🚨 Inconsistency detected — DO NOT boost until fixed.${NC}"
  exit 1
fi
