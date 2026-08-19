# AdsPx — High-Performance Smart Link Platform & Link Cloaker

AdsPx is an enterprise-grade link management and traffic monetization platform engineered for high-volume publishers, Adsterra affiliates, and media buyers. Built with TanStack Start (React 19), Vite 7, Tailwind CSS v4, Self-Hosted Supabase, and Redis.

## Core Features

- 🛡️ **Advanced Anti-Bot Cloaking**: Multi-layered bot shield detecting headless crawlers, Facebook review bots, datacenter ASNs, and scanner bursts.
- 🎯 **Adsterra & Meta SubID Auto-Mapping**: Preserves `fbclid`, `utm_campaign`, and ad attribution parameters seamlessly.
- 💰 **International Earning Engine**: Transparent payout tracking at $1 per 100,000 verified human visits with USDT (TRC20, BEP20, ERC20) withdrawals.
- ☁️ **Cloudflare-Grade Multi-Domain Edge**: Zero-latency geo routing and full IP masking behind Cloudflare proxies.
- 📊 **Hybrid Time-Series Analytics**: Live second-accurate raw clicks merged with perpetual aggregated dimensions.

## Production Deployment

```bash
# 1. Clone repository
git clone https://github.com/abexpoit-blip/swiftpx.git
cd swiftpx

# 2. Install dependencies & build
npm install
npm run build

# 3. Start PM2 Cluster
pm2 start ecosystem.config.cjs
pm2 save
```

