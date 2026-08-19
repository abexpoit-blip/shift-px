// 12 fork-mode instances behind nginx least_conn (ports 4000..4011)
// Tuned for a 12 vCPU / 48 GB VPS: one worker per core, 3 GB ceiling each.
// Env is loaded from /opt/adspx-app-new/.env via --env-file on the node interpreter.
module.exports = {
  apps: Array.from({ length: 12 }, (_, i) => ({
    name: `adspx-${i}`,
    cwd: "/opt/adspx-app-new",
    script: ".output/server/index.mjs",
    interpreter: "node",
    interpreter_args:
      "--max-old-space-size=2560 --env-file=/opt/adspx-app-new/.env --import=/opt/adspx-app-new/scripts/uri-guard.mjs",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "3072M",
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: "10s",
    // Give workers up to 15s to flush in-memory click batch queue before SIGKILL.
    // Without this, every `pm2 stop` drops ~100 queued clicks (real data loss).
    kill_timeout: 15000,

    env: {
      PORT: String(4000 + i),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      INSTANCE_ID: String(i),
    },
  })),
};
