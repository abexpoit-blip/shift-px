#!/usr/bin/env bash
# Deploy Sleepox app on VPS (self-hosted, PM2 + Supabase docker stack)
# Usage on VPS:
#   cd /opt/sleepox-app-new && ./deploy.sh
#   ./deploy.sh logs      # live PM2 logs
#   ./deploy.sh status    # PM2 + supabase status
#   ./deploy.sh restart   # restart only (no pull/build)

set -e

APP_DIR="/opt/sleepox-app-new"
# Legacy single-app name (kept for cleanup); real workers are sleepox-0..7
PM2_NAME="sleepox"
PM2_WORKER_PREFIX="sleepox-"
SUPABASE_DIR="/opt/supabase-docker"
SCRIPT_PATH="$APP_DIR/deploy.sh"
BUILD_STAMP_FILE="$APP_DIR/.sleepox-build"
STAGING_DIR="$APP_DIR/.deploy-build"
BACKUP_DIST="$APP_DIR/dist.previous"
BACKUP_OUTPUT="$APP_DIR/.output.previous"

cd "$APP_DIR"

action="${1:-deploy}"

case "$action" in
  logs)
    pm2 logs --lines 100
    ;;
  status)
    echo "=== PM2 ==="
    pm2 list
    echo ""
    echo "=== Supabase containers ==="
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "supabase|realtime" || true
    ;;
  restart)
    echo "♻️  Restarting PM2 workers..."
    pm2 delete "$PM2_NAME" 2>/dev/null || true
    for i in 0 1 2 3 4 5 6 7; do pm2 delete "${PM2_WORKER_PREFIX}${i}" 2>/dev/null || true; done
    pm2 start ecosystem.config.cjs --update-env
    pm2 save
    ;;
  deploy|"")
    echo "🚀 Deploying sleepox app..."

    echo "📥 [1/4] git pull..."
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "⚠️  Local file changes detected. Saving them before pulling latest GitHub code..."
      git stash push -u -m "auto-stash before sleepox deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
    fi
    old_head="$(git rev-parse HEAD 2>/dev/null || true)"
    git pull --ff-only
    new_head="$(git rev-parse HEAD 2>/dev/null || true)"
    build_version="${new_head:-unknown}-$(date +%s)"

    if [ ! -f ".output/server/index.mjs" ] && [ ! -f "dist/server/index.mjs" ] && [ ! -f "dist/server/index.js" ]; then
      if [ -d "$BACKUP_OUTPUT" ]; then
        echo "🛟 Live build is missing/incomplete. Restoring previous .output before building..."
        rm -rf .output
        mv "$BACKUP_OUTPUT" .output
        pm2 restart "$PM2_NAME" --update-env || true
      elif [ -d "$BACKUP_DIST" ]; then
        echo "🛟 Live build is missing/incomplete. Restoring previous dist before building..."
        rm -rf dist
        mv "$BACKUP_DIST" dist
        pm2 restart "$PM2_NAME" --update-env || true
      fi
    fi

    if [ -n "$old_head" ] && [ "$old_head" != "$new_head" ] && git diff --name-only "$old_head" "$new_head" -- deploy.sh | grep -qx "deploy.sh"; then
      echo "🔁 deploy.sh updated from GitHub. Restarting with the latest deploy script..."
      chmod +x "$SCRIPT_PATH"
      exec "$SCRIPT_PATH" "$action"
    fi

    echo "🧰 [2/5] ensure maintenance DB objects..."
    if [ -f "scripts/vps-ensure-maintenance-db.sh" ]; then
      bash scripts/vps-ensure-maintenance-db.sh
    fi

    echo "📦 [3/5] prepare isolated build..."
    rm -rf "$STAGING_DIR"
    mkdir -p "$STAGING_DIR"
    tar \
      --exclude="./.git" \
      --exclude="./node_modules" \
      --exclude="./dist" \
      --exclude="./dist.previous" \
      --exclude="./.deploy-build" \
      -cf - . | tar -xf - -C "$STAGING_DIR"

    echo "🔨 [4/5] install + build in staging..."
    (
      cd "$STAGING_DIR"
      bun install
      APP_BUILD_VERSION="$build_version" bun run build
    )

    BUILD_OUTPUT_DIR=""
    if [ -d "$STAGING_DIR/.output/public" ] && [ -f "$STAGING_DIR/.output/server/index.mjs" ]; then
      BUILD_OUTPUT_DIR=".output"
      echo "✅ Found Node self-host build in .output/"
    elif [ -d "$STAGING_DIR/dist/client" ] && { [ -f "$STAGING_DIR/dist/server/index.mjs" ] || [ -f "$STAGING_DIR/dist/server/index.js" ]; }; then
      BUILD_OUTPUT_DIR="dist"
      echo "✅ Found build in dist/"
    else
      echo "❌ Build output is incomplete (missing server entry). Live app was NOT changed."
      ls -R "$STAGING_DIR/.output" 2>/dev/null || echo ".output folder is empty or missing"
      ls -R "$STAGING_DIR/dist" 2>/dev/null || echo "dist folder is empty or missing"
      exit 1
    fi

    echo "🛑 [5/5] stopping all PM2 workers before swapping build artifacts..."
    pm2 delete "$PM2_NAME" 2>/dev/null || true
    for i in 0 1 2 3 4 5 6 7; do pm2 delete "${PM2_WORKER_PREFIX}${i}" 2>/dev/null || true; done

    echo "🚚 Publishing verified build..."
    rm -rf "$BACKUP_DIST" "$BACKUP_OUTPUT"
    if [ "$BUILD_OUTPUT_DIR" = ".output" ]; then
      if [ -d ".output" ]; then
        mv .output "$BACKUP_OUTPUT"
      fi
      rm -rf dist
      mv "$STAGING_DIR/.output" .output
    else
      if [ -d "dist" ]; then
        mv dist "$BACKUP_DIST"
      fi
      rm -rf .output
      mv "$STAGING_DIR/dist" dist
    fi
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$BUILD_STAMP_FILE"

    echo "♻️  Starting all 8 PM2 workers from ecosystem config..."
    pm2 start ecosystem.config.cjs --update-env

    pm2 save || true
    rm -rf "$STAGING_DIR"

    echo ""
    echo "✅ Deploy complete!"
    echo "Build stamp: $(cat "$BUILD_STAMP_FILE")"
    pm2 list
    ;;
  *)
    echo "Unknown action: $action"
    echo "Usage: ./deploy.sh [deploy|logs|status|restart]"
    exit 1
    ;;
esac
