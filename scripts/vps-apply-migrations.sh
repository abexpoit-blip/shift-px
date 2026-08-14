#!/usr/bin/env bash
# Apply SQL migrations on the VPS without needing DATABASE_URL exported.
#
# Resolution order:
#   1) $DATABASE_URL / $SUPABASE_DATABASE_URL from the environment
#   2) DATABASE_URL / SUPABASE_DATABASE_URL from /opt/adspx-app-new/.env
#   3) POSTGRES_PASSWORD from .env  -> postgres://postgres:***@127.0.0.1:5432/postgres
#   4) docker exec into the supabase-db container (no host psql needed)
#
# Usage:
#   bash scripts/vps-apply-migrations.sh                      # safe auto mode
#   bash scripts/vps-apply-migrations.sh migration/35_*.sql   # only these files
#
# 01_schema.sql is a full pg_dump/bootstrap file, not an idempotent migration.
# Auto mode only uses it for a genuinely empty database. On an existing Adspx
# database it applies the safe incremental migrations instead.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/adspx-app-new}"
cd "$APP_DIR" 2>/dev/null || { echo "❌ APP_DIR not found: $APP_DIR"; exit 1; }

read_env() { # read_env KEY -> value from .env (never printed)
  [[ -f .env ]] || return 0
  grep -aE "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'
}

DB_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
[[ -z "$DB_URL" ]] && DB_URL="$(read_env DATABASE_URL)"
[[ -z "$DB_URL" ]] && DB_URL="$(read_env SUPABASE_DATABASE_URL)"
if [[ -z "$DB_URL" ]]; then
  PW="$(read_env POSTGRES_PASSWORD)"
  [[ -n "$PW" ]] && DB_URL="postgresql://postgres:${PW}@127.0.0.1:5432/postgres"
fi

DB_CONTAINER=""
if [[ -z "$DB_URL" ]] || ! command -v psql >/dev/null 2>&1; then
  DB_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'supabase.*db|^postgres' | head -1)"
fi

if [[ -z "$DB_URL" && -z "$DB_CONTAINER" ]]; then
  echo "❌ Could not reach the database."
  echo "   Neither DATABASE_URL / POSTGRES_PASSWORD in $APP_DIR/.env nor a running supabase-db container."
  echo "   Check with: docker ps --format '{{.Names}}\t{{.Status}}'"
  exit 1
fi

if [[ -n "$DB_CONTAINER" ]]; then
  echo "🔌 Using database container: $DB_CONTAINER"
  run_sql_file() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$1"; }
  run_sql()      { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -tA -c "$1"; }
else
  echo "🔌 Using DATABASE_URL from environment/.env"
  run_sql_file() { psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$1"; }
  run_sql()      { psql "$DB_URL" -tA -c "$1"; }
fi

# Sanity: can we actually talk to it?
if ! run_sql "select 1" >/dev/null 2>&1; then
  echo "❌ Connected to a client but the query failed. Is the DB container healthy?"
  docker ps --filter name=supabase-db --format '{{.Names}}\t{{.Status}}' 2>/dev/null
  exit 1
fi

FILES=("$@")
if [[ ${#FILES[@]} -eq 0 ]]; then
  HAS_CORE_SCHEMA="$(run_sql "SELECT CASE WHEN to_regclass('public.links') IS NULL THEN 'no' ELSE 'yes' END" 2>/dev/null || true)"
  if [[ "$HAS_CORE_SCHEMA" == "yes" ]]; then
    FILES=(
      migration/33_links_url_columns.sql
      migration/34_clear_legacy_safe_urls.sql
      migration/35_hybrid_click_storage.sql
      migration/36_links_is_active.sql
      migration/37_missing_rpcs.sql
      migration/38_missing_tables.sql
      migration/39_links_blocked_countries.sql
      migration/40_profiles_missing_columns.sql


    )
    echo "ℹ️  Existing Adspx database detected; skipping the non-idempotent 01_schema.sql bootstrap."
  else
    mapfile -t FILES < <(ls -1 migration/*.sql | sort -V)
    echo "ℹ️  Empty database detected; running the complete bootstrap sequence."
  fi
fi

FAILED=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "⚠️  skip (missing): $f"; continue; }
  echo ""
  echo "== $f"
  if run_sql_file "$f"; then
    echo "   ✅ applied"
  else
    echo "   ❌ FAILED: $f"
    FAILED=1
    break
  fi
done

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "🎉 All migrations applied."
  run_sql "SELECT 'clicks=' || pg_size_pretty(pg_total_relation_size('public.clicks'))
        || ' archive=' || COALESCE(pg_size_pretty(pg_total_relation_size('public.click_dim_daily')), 'n/a')
        || ' raw_rows=' || (SELECT count(*) FROM public.clicks);" 2>/dev/null || true
else
  echo "⛔ Stopped on the first failure — nothing after it was applied."
  exit 1
fi
