# Cloudflare DNS — Adspx (নতুন করে সেটআপ)

VPS IP: আপনার সার্ভারের IP (নিচে `VPS_IP` লেখা জায়গায় বসান)।

## ১) adspx.com জোনে যা যা রেকর্ড দিতে হবে

| Type | Name       | Content | Proxy               | কেন                                                                        |
| ---- | ---------- | ------- | ------------------- | -------------------------------------------------------------------------- |
| A    | `@`        | VPS_IP  | **Proxied (কমলা)**  | মূল SaaS সাইট                                                              |
| A    | `www`      | VPS_IP  | **Proxied (কমলা)**  | www → same app                                                             |
| A    | `supabase` | VPS_IP  | **DNS only (ধূসর)** | self-host Supabase API; proxy করলে realtime/websocket ও certbot ঝামেলা করে |

SSL/TLS সেটিং (adspx.com জোন):

- SSL/TLS mode: **Full (strict)**
- Always Use HTTPS: **On**
- Automatic HTTPS Rewrites: **On**
- Grey-cloud না করা পর্যন্ত certbot চালাবেন না — প্রথমবার সার্টিফিকেট নেওয়ার সময় `@` ও `www` সাময়িকভাবে **DNS only** করুন, সার্টিফিকেট হয়ে গেলে আবার Proxied করুন।

## ২) adswapx.com জোন (shortener)

| Type | Name  | Content | Proxy                  |
| ---- | ----- | ------- | ---------------------- |
| A    | `@`   | VPS_IP  | **DNS only (ধূসর)** ❗ |
| A    | `www` | VPS_IP  | **DNS only (ধূসর)** ❗ |

⚠️ shortener ডোমেইন কখনোই Proxied করবেন না — Cloudflare proxy করলে ভিজিটরের আসল IP/ASN বদলে যায়, আমাদের bot-detection ভুল সিদ্ধান্ত নেয় (real human safe page পেয়ে যায়)। তাই সবসময় grey cloud, এবং SSL Let's Encrypt (nginx/certbot) থেকেই আসবে।

## ৩) রেকর্ড দেওয়ার পর VPS-এ

```bash
# DNS ঠিক আছে কিনা
dig +short adspx.com
dig +short adswapx.com
dig +short supabase.adspx.com
```

তিনটাই VPS_IP দেখালে nginx + certbot ধাপে যান।
