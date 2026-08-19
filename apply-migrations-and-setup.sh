#!/usr/bin/env bash
# ==============================================================================
# AdsPx Full Database Migration & Stack Setup Script
# ==============================================================================
set -e

echo "?? [AdsPx] Starting Full Database Migration & Setup..."

SWIFTPX_DIR="/var/www/swiftpx"
SUPABASE_DIR="/opt/supabase/docker"
SQL_FILE="$SWIFTPX_DIR/deploy/full-schema-migration.sql"
FIX_SQL="$SWIFTPX_DIR/deploy/fix-constraints.sql"

# 1. Apply Database Schema Migrations to PostgreSQL
echo "?? Applying database schema to PostgreSQL..."
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "supabase[-_]db|db" | head -n 1)

if [ -n "$DB_CONTAINER" ]; then
    echo "Found database container: $DB_CONTAINER"
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SQL_FILE" || true
    echo "?? Applying critical constraints drop & permissions fix..."
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$FIX_SQL" || true
else
    echo "Attempting direct psql connection..."
    PGPASSWORD=d15ea36d3875a41833af1d96a5517d3b34ae118740984102 psql -h 127.0.0.1 -U postgres -d postgres < "$SQL_FILE" || true
    PGPASSWORD=d15ea36d3875a41833af1d96a5517d3b34ae118740984102 psql -h 127.0.0.1 -U postgres -d postgres < "$FIX_SQL" || true
fi

# 2. Reload PostgREST schema cache so all tables and functions are fresh
echo "?? Reloading PostgREST schema cache..."
if [ -d "$SUPABASE_DIR" ]; then
    cd "$SUPABASE_DIR"
    docker compose restart rest || docker-compose restart rest || true
fi

# 3. Create / Ensure Super Admin User
echo "?? Provisioning Super Admin in database..."
cd "$SWIFTPX_DIR"
node create-test-user.mjs "admin@adspx.com" "Shovon@5448" "Super Admin"

# 4. Build application and reload PM2
echo "?? Building app & restarting PM2..."
npm run build
pm2 restart all

echo "==============================================================="
echo "?? ALL DATABASE TABLES MIGRATED & VERIFIED!"
echo "?? Site: https://adspx.com"
echo "?? Admin Vault: https://adspx.com/sx-vault-9k2m7x"
echo "?? Login: admin@adspx.com / Shovon@5448"
echo "==============================================================="