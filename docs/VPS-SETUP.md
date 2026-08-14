# Adspx — নতুন VPS-এ A থেকে Z সেটআপ (Bangla, step-by-step)

Repo: `https://github.com/abexpoit-blip/shift-px`
App folder: `/opt/adspx-app-new`
Supabase folder: `/opt/supabase-docker`
Domains: `adspx.com` (main SaaS) + `adswapx.com` (shortener)

প্রতিটা ধাপ এক এক করে কপি-পেস্ট করুন। `root` ইউজারে VPS-এ SSH করে শুরু করুন।

---

## ধাপ ০ — VPS-এ লগইন

```bash
ssh root@YOUR_VPS_IP
```

## ধাপ ১ — বেসিক প্যাকেজ + ফায়ারওয়াল

```bash
apt update && apt upgrade -y
apt install -y curl git ufw nginx unzip build-essential ca-certificates gnupg postgresql-client redis-server

ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

systemctl enable --now redis-server
```

## ধাপ ২ — Node 22 + PM2 + Bun

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm i -g pm2
curl -fsSL https://bun.sh/install | bash
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
node -v && bun -v
```

## ধাপ ৩ — Docker (Supabase self-host এর জন্য)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version
```

## ধাপ ৪ — Supabase self-host চালু করা

```bash
mkdir -p /opt && cd /opt
git clone --depth 1 https://github.com/supabase/supabase supabase-src
mkdir -p /opt/supabase-docker
cp -r /opt/supabase-src/docker/* /opt/supabase-docker/
cd /opt/supabase-docker
cp .env.example .env
nano .env
```

`.env`-এ এই মানগুলো বসান (আপনার আগের কী-গুলো):

```
POSTGRES_PASSWORD=<your postgres password>
JWT_SECRET=<your jwt secret>
ANON_KEY=<your anon key>
SERVICE_ROLE_KEY=<your service role key>
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=<your dashboard password>
SECRET_KEY_BASE=<your secret key base>
VAULT_ENC_KEY=<your vault key>
SITE_URL=https://adspx.com
API_EXTERNAL_URL=https://supabase.adspx.com
SUPABASE_PUBLIC_URL=https://supabase.adspx.com
```

চালু করুন:

```bash
docker compose up -d
docker ps
```

> ⚠️ চ্যাটে শেয়ার করা পুরনো কী-গুলো নতুন VPS-এ নতুন করে জেনারেট করা নিরাপদ (openssl rand -hex 32)।

## ধাপ ৫ — কোড ক্লোন

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/abexpoit-blip/shift-px.git adspx-app-new
cd /opt/adspx-app-new
chmod +x deploy.sh scripts/*.sh
```

## ধাপ ৬ — `.env` তৈরি

```bash
nano /opt/adspx-app-new/.env
```

```
NODE_ENV=production
APP_URL=https://adspx.com

VITE_SUPABASE_URL=https://supabase.adspx.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=adspx

SUPABASE_URL=https://supabase.adspx.com
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres
REDIS_URL=redis://127.0.0.1:6379
```

চেক:

```bash
cd /opt/adspx-app-new && npm run verify-env
```

## ধাপ ৭ — ডাটাবেস মাইগ্রেশন

```bash
cd /opt/adspx-app-new
export DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres"
for f in migration/*.sql; do echo "== $f"; psql "$DATABASE_URL" -f "$f"; done
```

## ধাপ ৮ — বিল্ড + PM2 চালু

```bash
cd /opt/adspx-app-new
bun install
bun run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root   # যে লাইনটা প্রিন্ট করবে সেটা চালান
pm2 list
```

## ধাপ ৯ — DNS (ডোমেইন পয়েন্ট)

রেজিস্ট্রার/Cloudflare DNS-এ:

| Host | Type | Value | Proxy |
|------|------|-------|-------|
| `adspx.com` | A | VPS IP | Proxied (কমলা) ✅ |
| `www.adspx.com` | A | VPS IP | Proxied ✅ |
| `supabase.adspx.com` | A | VPS IP | **DNS only** (ধূসর) |
| `adswapx.com` | A | VPS IP | **DNS only** ❗ |
| `www.adswapx.com` | A | VPS IP | **DNS only** ❗ |

**কেন adswapx.com Cloudflare proxy করা যাবে না:** proxy করলে ভিজিটরের আসল IP / ASN হেডার বদলে যায়, আমাদের bot-detection ভুল সিদ্ধান্ত নেয় এবং real human-ও safe article পেতে পারে। তাই shortener ডোমেইন সবসময় DNS-only।

Cloudflare SSL/TLS setting (adspx.com এর জন্য): **Full (strict)**, Always Use HTTPS = On.

## ধাপ ১০ — Nginx

```bash
cp /opt/adspx-app-new/deploy/nginx-adspx.conf /etc/nginx/sites-available/adspx
ln -sf /etc/nginx/sites-available/adspx /etc/nginx/sites-enabled/adspx
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## ধাপ ১১ — SSL সার্টিফিকেট (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d adspx.com -d www.adspx.com -d supabase.adspx.com -d adswapx.com -d www.adswapx.com \
  --agree-tos -m you@example.com --redirect
systemctl status certbot.timer   # অটো-রিনিউ চালু আছে কিনা
```

> Cloudflare-proxied ডোমেইনে certbot চালানোর আগে সাময়িকভাবে proxy বন্ধ (ধূসর) করে নিন, সার্টিফিকেট ইস্যু হলে আবার কমলা করুন।

## ধাপ ১২ — যাচাই

```bash
curl -I https://adspx.com
curl -I https://adswapx.com
pm2 logs --lines 50
```

- `https://adspx.com` → Adspx ল্যান্ডিং + লগইন
- `https://adswapx.com` → নিউট্রাল কনটেন্ট (SaaS পেজ ৪০৪) ✅ এটাই ঠিক আচরণ

---

## প্রতিবার কোড আপডেটের কমান্ড

```bash
cd /opt/adspx-app-new && ./deploy.sh deploy && pm2 logs --lines 60
```

## নতুন মাইগ্রেশন চালানো

```bash
cd /opt/adspx-app-new && psql "$DATABASE_URL" -f migration/30_adspx_monetisation_reroute.sql
```

## সমস্যা হলে

```bash
pm2 list                 # ওয়ার্কার স্ট্যাটাস
pm2 logs adspx-0 --lines 100
nginx -t                 # nginx config চেক
docker ps                # supabase কন্টেইনার
systemctl status redis-server
```

---

## 13. 12 vCPU / 48 GB tuning (Adspx high-scale)

**App workers** — `ecosystem.config.cjs` now runs 12 fork-mode workers on ports
4000–4011 (one per core, 3 GB ceiling each) and nginx `upstream adspx_backend`
balances them with `least_conn`.

```bash
cd /opt/adspx-app-new && git pull && bun install && bun run build
pm2 delete all; pm2 start ecosystem.config.cjs && pm2 save
sudo nginx -t && sudo systemctl reload nginx
```

**PostgreSQL** (self-hosted Supabase `postgres` container / `postgresql.conf`):

```
shared_buffers = 12GB
effective_cache_size = 32GB
work_mem = 32MB
maintenance_work_mem = 2GB
max_connections = 400
max_parallel_workers = 12
max_parallel_workers_per_gather = 4
random_page_cost = 1.1
```

**Hybrid retention (no data loss)** — apply once. Use the runner below; it
finds the database itself (env → `.env` → `supabase-db` container), so you
never need `DATABASE_URL` exported in the shell:

```bash
bash scripts/vps-apply-migrations.sh            # auto: existing DB gets safe incremental migrations
bash scripts/vps-apply-migrations.sh migration/35_hybrid_click_storage.sql
```

`01_schema.sql` is a full bootstrap dump, so the runner only applies it to an
empty database. It is automatically skipped when the existing `links` table is
detected.


Then schedule the weekly job (Sunday 03:00 UTC). It archives lifetime totals
into `link_lifetime_stats` / `user_lifetime_stats` **before** trimming raw
click rows older than 7 days:

```bash
crontab -e
# 0 3 * * 0 cd /opt/adspx-app-new && bun scripts/run-maintenance.ts >> /var/log/adspx-maintenance.log 2>&1
```

Users, links, balances and withdrawals are never deleted automatically —
only an admin can remove a dormant account from Control Panel → Maintenance →
Dormant Users (default filter: no login for 15 days).
