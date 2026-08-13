#!/usr/bin/env bash
# ============================================================
# Adspx — নতুন VPS-এ একদম শুরু থেকে সেটআপ (এক কমান্ড)
#
#   bash vps-fresh-setup.sh
#
# যা করে: packages → node/bun/pm2 → docker → redis → fresh
# project folder → git clone → .env template → nginx → SSL হিন্ট
# আগের ফোল্ডার থাকলে ব্যাকআপ করে নতুন করে বানায়।
# ============================================================
set -euo pipefail

APP_DIR="/opt/adspx-app-new"      # ecosystem.config.cjs + deploy.sh এই পাথ ধরে চলে — বদলাবেন না
REPO_DEFAULT="https://github.com/abexpoit-blip/shift-px.git"

say() { echo -e "\n\033[1;36m➤ $*\033[0m"; }
ok()  { echo -e "\033[1;32m✔ $*\033[0m"; }

[ "$(id -u)" -eq 0 ] || { echo "root ইউজারে চালান: sudo bash $0"; exit 1; }

# ---------- 0. repo + credentials ----------
read -rp "GitHub repo URL [$REPO_DEFAULT]: " REPO
REPO="${REPO:-$REPO_DEFAULT}"

echo
echo "রিপো কি private? private হলে GitHub password কাজ করে না — Personal Access Token লাগবে।"
echo "Token বানান: github.com → Settings → Developer settings → Personal access tokens"
echo "             → Tokens (classic) → Generate new token → scope: repo"
read -rp "Repo private? (y/N): " IS_PRIVATE

CLONE_URL="$REPO"
if [[ "${IS_PRIVATE,,}" == "y" ]]; then
  read -rp "GitHub username: " GH_USER
  read -rsp "GitHub Personal Access Token (ghp_...): " GH_TOKEN; echo
  CLONE_URL="https://${GH_USER}:${GH_TOKEN}@${REPO#https://}"
fi

# ---------- 1. base packages ----------
say "[1/8] সিস্টেম প্যাকেজ ইনস্টল"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx unzip build-essential ca-certificates \
  gnupg postgresql-client redis-server certbot python3-certbot-nginx
systemctl enable --now redis-server
ok "packages ready"

say "[2/8] ফায়ারওয়াল"
ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null
ufw --force enable >/dev/null
ok "ufw enabled (22/80/443)"

# ---------- 2. node / bun / pm2 ----------
say "[3/8] Node 22 + PM2 + Bun"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2 >/dev/null
if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
fi
ok "node $(node -v) / bun $(bun -v) / pm2 $(pm2 -v)"

# ---------- 3. docker ----------
say "[4/8] Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
ok "docker ready"

# ---------- 4. fresh project folder ----------
say "[5/8] নতুন project folder"
pm2 delete all >/dev/null 2>&1 || true
if [ -d "$APP_DIR" ]; then
  BK="/opt/adspx-backup-$(date +%Y%m%d-%H%M%S)"
  mv "$APP_DIR" "$BK"
  echo "পুরনো ফোল্ডার ব্যাকআপ: $BK"
fi
mkdir -p /opt
git clone "$CLONE_URL" "$APP_DIR"
cd "$APP_DIR"
git remote set-url origin "$REPO"   # টোকেন ডিস্কে সেভ থাকবে না
chmod +x deploy.sh scripts/*.sh 2>/dev/null || true
ok "clone হয়েছে → $APP_DIR"

# ---------- 5. .env template ----------
say "[6/8] .env টেমপ্লেট"
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" <<'EOF'
NODE_ENV=production
APP_URL=https://adspx.com

VITE_SUPABASE_URL=https://supabase.adspx.com
VITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=adspx

SUPABASE_URL=https://supabase.adspx.com
SUPABASE_PUBLISHABLE_KEY=REPLACE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_SERVICE_ROLE_KEY

DATABASE_URL=postgresql://postgres:REPLACE_POSTGRES_PASSWORD@127.0.0.1:5432/postgres
REDIS_URL=redis://127.0.0.1:6379
EOF
  chmod 600 "$APP_DIR/.env"
  echo "→ এখন এডিট করুন: nano $APP_DIR/.env"
else
  echo ".env আগে থেকেই আছে, রাখা হলো"
fi

# ---------- 6. nginx ----------
say "[7/8] Nginx কনফিগ"
if [ -f "$APP_DIR/deploy/nginx-adspx.conf" ]; then
  cp "$APP_DIR/deploy/nginx-adspx.conf" /etc/nginx/sites-available/adspx
  ln -sf /etc/nginx/sites-available/adspx /etc/nginx/sites-enabled/adspx
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx && ok "nginx চালু"
fi

# ---------- 7. next steps ----------
say "[8/8] সেটআপ শেষ — এখন এই ধাপগুলো হাতে করুন"
cat <<EOF

  1) Supabase self-host চালু করুন:
       docs/VPS-SETUP.md এর ধাপ ৪ দেখুন (/opt/supabase-docker)

  2) .env পূরণ করুন:
       nano $APP_DIR/.env
       cd $APP_DIR && npm run verify-env

  3) মাইগ্রেশন চালান:
       cd $APP_DIR
       export DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres"
       for f in migration/*.sql; do echo "== \$f"; psql "\$DATABASE_URL" -f "\$f"; done

  4) বিল্ড + চালু:
       cd $APP_DIR && bun install && bun run build
       pm2 start ecosystem.config.cjs && pm2 save && pm2 startup

  5) SSL:
       certbot --nginx -d adspx.com -d www.adspx.com -d supabase.adspx.com \\
               -d adswapx.com -d www.adswapx.com --agree-tos --redirect

EOF
ok "vps-fresh-setup সম্পন্ন"
