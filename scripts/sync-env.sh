#!/usr/bin/env bash
# Sync local .env to VPS
# Run this if you changed your Supabase keys or other environment variables

set -e

VPS_HOST="${VPS_HOST:-75.119.144.171}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="/opt/sleepox-app-new"

if [ ! -f .env ]; then
  echo "❌ Error: .env file not found in current directory."
  exit 1
fi

echo "🔐 Syncing .env to VPS ($VPS_HOST)..."
scp .env "${VPS_USER}@${VPS_HOST}:${APP_DIR}/.env"

echo "✅ .env synced successfully!"
