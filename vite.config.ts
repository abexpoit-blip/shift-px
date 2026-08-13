import { defineConfig } from "@lovable.dev/vite-tanstack-config";
const appBuildVersion = process.env.APP_BUILD_VERSION || process.env.GIT_COMMIT_SHA || `${Date.now()}`;
export default defineConfig({
  nitro: { preset: "node-server" },
  tanstackStart: { server: { entry: "server" } },
  vite: {
    define: { __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion) },
    preview: { host: "0.0.0.0", port: 3000, allowedHosts: ["sleepox.com", "75.119.144.171"] },
    server: { host: "0.0.0.0", allowedHosts: ["sleepox.com", "75.119.144.171"] },
    build: { chunkSizeWarningLimit: 800 },
  },
});
