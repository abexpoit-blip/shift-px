#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4000}"
HOST="${HOST:-127.0.0.1}"
WRANGLER_CLI="node_modules/wrangler/wrangler-dist/cli.js"
ENV_FILE=".env"

echo "🔍 Starting Sleepox diagnostic..."
pwd
ls -ld dist/server 2>/dev/null || echo "ℹ️ dist/server folder missing"
ls -l dist/server/index.mjs 2>/dev/null || echo "ℹ️ dist/server/index.mjs missing"
ls -ld .output/server 2>/dev/null || echo "ℹ️ .output/server folder missing"
ls -l .output/server/index.mjs 2>/dev/null || echo "ℹ️ .output/server/index.mjs missing"

if [ -f "dist/server/index.mjs" ]; then
  echo "🚀 Executing node dist/server/index.mjs"
  exec node dist/server/index.mjs
fi

if [ -f ".output/server/index.mjs" ]; then
  echo "🚀 Executing node .output/server/index.mjs"
  exec node .output/server/index.mjs
fi

if [ -f "dist/server/index.js" ]; then
  echo "🚀 Executing node dist/server/index.js"
  exec node dist/server/index.js
fi

echo "📁 Contents of .output/server:"
ls -F .output/server/ 2>/dev/null || true
echo "📁 Contents of dist/server:"
ls -F dist/server/ 2>/dev/null || true

# Detect config
if [ -f "dist/server/wrangler.json" ]; then
  CONF="dist/server/wrangler.json"
else
  CONF="wrangler.jsonc"
fi

echo "🚀 Executing node $WRANGLER_CLI dev --port $PORT --local"

exec node "$WRANGLER_CLI" dev \
  --config "$CONF" \
  --env-file "$ENV_FILE" \
  --port "$PORT" \
  --ip "$HOST" \
  --local \
  --show-interactive-dev-session=false
