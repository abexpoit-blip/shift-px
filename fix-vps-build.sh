#!/usr/bin/env bash
set -euo pipefail

# 1. Update config to use node-server preset
cat <<'VITE_CONF' > vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const appBuildVersion =
  process.env.APP_BUILD_VERSION || process.env.GIT_COMMIT_SHA || `${Date.now()}`;

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion),
    },
    preview: {
      host: "0.0.0.0",
      port: 4000,
      allowedHosts: ["sleepox.com", "www.sleepox.com", "75.119.144.171", "localhost"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["sleepox.com", "www.sleepox.com", "75.119.144.171", "localhost"],
    },
  },
});
VITE_CONF

# 2. Rebuild the app (this generates the dist/server/index.mjs file)
rm -rf .output dist
bun run build

# 3. Recreate PM2 app from the ecosystem config so stale saved paths are removed
pm2 delete sleepox || true
PORT=4000 HOST=0.0.0.0 pm2 start ecosystem.config.cjs --only sleepox --update-env
pm2 save

echo "Waiting for app to start..."
sleep 5
curl -s -I http://127.0.0.1:4000 | grep "HTTP" && echo "✅ Website is BACK ONLINE" || echo "⚠️ Still failing local check"
