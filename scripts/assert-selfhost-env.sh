#!/usr/bin/env bash
# HARD GUARD — Adspx must NEVER talk to hosted supabase.co / supabase.in.
# Runs against /opt/adspx-app-new/.env and /opt/supabase-docker/.env.
# Exit 1 = deploy must stop.
set -uo pipefail

APP_ENV="${APP_ENV_FILE:-/opt/adspx-app-new/.env}"
SB_ENV="${SB_ENV_FILE:-/opt/supabase-docker/.env}"
fail=0

red()  { echo -e "\033[1;31m✖ $*\033[0m"; }
grn()  { echo -e "\033[1;32m✔ $*\033[0m"; }

# 1. no hosted Supabase anywhere
for f in "$APP_ENV" "$SB_ENV"; do
  [ -f "$f" ] || { red "missing env file: $f"; fail=1; continue; }
  if grep -Eiq '(supabase\.co|supabase\.in|supabase\.net)' "$f"; then
    red "$f contains a HOSTED supabase domain — self-host only!"
    grep -Ein '(supabase\.co|supabase\.in|supabase\.net)' "$f" | sed 's/=.*/=<hidden>/'
    fail=1
  fi
done

# 2. app env must point at our own supabase host
if [ -f "$APP_ENV" ]; then
  for key in SUPABASE_URL VITE_SUPABASE_URL; do
    val="$(grep -E "^${key}=" "$APP_ENV" | head -1 | cut -d= -f2-)"
    case "$val" in
      https://supabase.adspx.com*) ;;
      "") red "$key is missing in $APP_ENV"; fail=1 ;;
      *)  red "$key must be https://supabase.adspx.com (got a different host)"; fail=1 ;;
    esac
  done
  # 3. no placeholders left
  if grep -q 'REPLACE_' "$APP_ENV"; then
    red "$APP_ENV still has REPLACE_ placeholders"; fail=1
  fi
  # 4. permissions
  perm="$(stat -c %a "$APP_ENV")"
  [ "$perm" = "600" ] || { red "$APP_ENV permissions are $perm — must be 600"; fail=1; }
fi

# 5. secrets must never be committed
if [ -d /opt/adspx-app-new/.git ]; then
  if git -C /opt/adspx-app-new ls-files --error-unmatch .env >/dev/null 2>&1; then
    red ".env is tracked by git — remove it: git rm --cached .env"; fail=1
  fi
fi

if [ "$fail" -eq 0 ]; then
  grn "self-host env guard passed (no hosted supabase, correct host, 600 perms, .env untracked)"
else
  echo; red "GUARD FAILED — ঠিক না করা পর্যন্ত deploy করবেন না।"
fi
exit "$fail"
