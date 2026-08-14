#!/usr/bin/env bash
# Fix: adswapx.com serves the adspx.com certificate (ERR_CERT_COMMON_NAME_INVALID).
# Cause: the Let's Encrypt cert was issued without the adswapx.com SANs.
# This re-issues ONE cert covering all four hostnames and reloads nginx.
set -euo pipefail

DOMAINS=(adspx.com www.adspx.com adswapx.com www.adswapx.com)
EMAIL="${CERTBOT_EMAIL:-admin@adspx.com}"

echo "== 1. DNS check (adswapx.com must be DNS-only / grey cloud) =="
for d in adswapx.com www.adswapx.com adspx.com; do
  echo "  $d -> $(dig +short "$d" | tr '\n' ' ')"
done
echo "  this server -> $(curl -s4 https://ifconfig.me || true)"

echo
echo "== 2. ACME webroot =="
mkdir -p /var/www/html/.well-known/acme-challenge
echo ok > /var/www/html/.well-known/acme-challenge/ping

echo
echo "== 3. Current certificates =="
certbot certificates || true

echo
echo "== 4. Re-issue single cert with all SANs =="
ARGS=()
for d in "${DOMAINS[@]}"; do ARGS+=(-d "$d"); done
certbot --nginx --non-interactive --agree-tos --email "$EMAIL" \
  --cert-name adspx.com --expand --redirect "${ARGS[@]}"

echo
echo "== 5. Reload nginx =="
nginx -t && systemctl reload nginx

echo
echo "== 6. Verify =="
for d in "${DOMAINS[@]}"; do
  echo "--- $d"
  echo | openssl s_client -servername "$d" -connect 127.0.0.1:443 2>/dev/null \
    | openssl x509 -noout -subject -ext subjectAltName || true
done
echo "done."
