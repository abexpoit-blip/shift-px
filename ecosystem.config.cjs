// 12 fork-mode instances behind nginx least_conn (ports 4000..4011)
// Tuned for a 12 vCPU / 48 GB VPS: one worker per core.
const path = require("path");
const appDir = process.env.APP_DIR || "/var/www/swiftpx";

module.exports = {
  apps: Array.from({ length: 12 }, (_, i) => ({
    name: `adspx-${i}`,
    cwd: appDir,
    script: ".output/server/index.mjs",
    interpreter: "node",
    interpreter_args: `--max-old-space-size=2560 --env-file=${appDir}/.env`,
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "3072M",
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: "10s",
    kill_timeout: 15000,

    env: {
      PORT: String(4000 + i),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      INSTANCE_ID: String(i),
      VITE_SUPABASE_URL: "http://127.0.0.1:8000",
      SUPABASE_URL: "http://127.0.0.1:8000",
      SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyODE0NjM5LCJleHAiOjIwOTgxNzQ2Mzl9.uzi5eworVCioXTFFqf0sojuQrwgeRZ7tV7dzRQ8BZ8E",
      VITE_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyODE0NjM5LCJleHAiOjIwOTgxNzQ2Mzl9.uzi5eworVCioXTFFqf0sojuQrwgeRZ7tV7dzRQ8BZ8E",
      SUPABASE_SERVICE_ROLE_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM",
      SERVICE_ROLE_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM",
      REDIS_URL: "redis://127.0.0.1:6379",
    },
  })),
};
