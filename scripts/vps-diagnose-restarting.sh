#!/usr/bin/env bash
# Print last logs of every Supabase container that is restarting / unhealthy.
# Run on the VPS:  ./scripts/vps-diagnose-restarting.sh
set -u

CONTAINERS=(supabase-auth supabase-rest supabase-storage supabase-pooler supabase-analytics realtime-dev.supabase-realtime)

echo "================ docker ps ================"
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo

for c in "${CONTAINERS[@]}"; do
  echo
  echo "=================================================="
  echo "  $c  — status:"
  docker inspect -f '{{.State.Status}} (restarts={{.RestartCount}}, exitcode={{.State.ExitCode}}, error={{.State.Error}})' "$c" 2>/dev/null || echo "  (not found)"
  echo "--------------------- last 60 log lines ---------------------"
  docker logs --tail 60 "$c" 2>&1 || true
done

echo
echo "================ supabase-db readiness ================"
docker exec supabase-db pg_isready -U postgres 2>&1 || true
echo
echo "================ supabase-db roles ================"
docker exec supabase-db psql -U postgres -tAc "select rolname from pg_roles where rolname in ('authenticator','supabase_auth_admin','supabase_storage_admin','supabase_admin','anon','authenticated','service_role','pgbouncer','supabase_read_only_user') order by 1;" 2>&1 || true

if docker logs --tail 250 supabase-storage 2>&1 | grep -q 'password authentication failed for user "supabase_storage_admin"' \
  || docker logs --tail 250 supabase-pooler 2>&1 | grep -q 'password authentication failed for user "supabase_admin"' \
  || docker logs --tail 250 realtime-dev.supabase-realtime 2>&1 | grep -q 'password authentication failed for user "supabase_admin"'; then
  echo
  echo "================ recommended fix ================"
  echo "Detected internal database role password mismatch. Run:"
  echo "  chmod +x scripts/vps-fix-supabase-db-passwords.sh && ./scripts/vps-fix-supabase-db-passwords.sh"
fi
