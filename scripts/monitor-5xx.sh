#!/bin/bash
# 5xx Error Monitor — runs every minute via cron.
# Checks last 1 minute of nginx access log for 5xx errors AND PM2 process health.
# Sends Telegram alert if anything is wrong.
#
# Setup (one-time):
#   1) Create a Telegram bot via @BotFather → get BOT_TOKEN
#   2) Send a message to your bot, then visit:
#      https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
#      → copy your CHAT_ID
#   3) Add to /opt/sleepox-app-new/.env:
#      TELEGRAM_BOT_TOKEN=123456:ABC...
#      TELEGRAM_CHAT_ID=987654321
#   4) Install: crontab -e
#      * * * * * /opt/sleepox-app-new/scripts/monitor-5xx.sh >> /var/log/sleepox-monitor.log 2>&1

set -u

cd /opt/sleepox-app-new
set -a
source .env 2>/dev/null || true
set +a

NGINX_LOG="${NGINX_LOG:-/var/log/nginx/access.log}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-3}"  # alert if 3+ 5xx errors in last minute
STATE_FILE="/tmp/sleepox-monitor-last-alert"
COOLDOWN_SEC=300  # don't re-alert for same issue within 5 minutes

send_alert() {
  local MESSAGE="$1"

  # Cooldown check
  if [ -f "$STATE_FILE" ]; then
    LAST=$(cat "$STATE_FILE")
    NOW=$(date +%s)
    if [ $((NOW - LAST)) -lt $COOLDOWN_SEC ]; then
      echo "$(date) [SKIPPED — cooldown] $MESSAGE"
      return
    fi
  fi
  date +%s > "$STATE_FILE"

  echo "$(date) [ALERT] $MESSAGE"

  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -sS --max-time 10 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=Markdown" \
      -d "text=🚨 *Sleepox Alert*%0A%0A${MESSAGE}%0A%0A_$(date)_" \
      > /dev/null
  else
    echo "(no TELEGRAM_BOT_TOKEN/CHAT_ID set — alert not sent)"
  fi
}

# ===== Check 1: PM2 processes all online =====
OFFLINE=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    bad = [p['name'] for p in procs if p.get('pm2_env',{}).get('status') != 'online']
    print(','.join(bad) if bad else '')
except Exception as e:
    print('PARSE_ERROR')
" 2>/dev/null)

if [ "$OFFLINE" = "PARSE_ERROR" ]; then
  send_alert "Could not read PM2 status (pm2 jlist failed)"
elif [ -n "$OFFLINE" ]; then
  send_alert "PM2 processes DOWN: \`$OFFLINE\` — site may be returning 502"
fi

# ===== Check 2: 5xx errors in nginx log (last 1 minute) =====
if [ -r "$NGINX_LOG" ]; then
  ONE_MIN_AGO=$(date -d '1 minute ago' '+%d/%b/%Y:%H:%M' 2>/dev/null || date -v-1M '+%d/%b/%Y:%H:%M' 2>/dev/null)
  NOW_STAMP=$(date '+%d/%b/%Y:%H:%M')

  COUNT_5XX=$(awk -v t1="$ONE_MIN_AGO" -v t2="$NOW_STAMP" '
    {
      # Extract timestamp [DD/Mon/YYYY:HH:MM
      match($0, /\[[0-9]+\/[A-Za-z]+\/[0-9]+:[0-9]+:[0-9]+/)
      if (RSTART > 0) {
        ts = substr($0, RSTART+1, 17)
        if (ts >= t1 && ts <= t2) {
          # status is field after "HTTP/1.x" — typically $9
          if ($9 ~ /^5[0-9][0-9]$/) print $9
        }
      }
    }
  ' "$NGINX_LOG" | wc -l)

  if [ "$COUNT_5XX" -ge "$ALERT_THRESHOLD" ]; then
    SAMPLE=$(awk -v t1="$ONE_MIN_AGO" '
      {
        match($0, /\[[0-9]+\/[A-Za-z]+\/[0-9]+:[0-9]+:[0-9]+/)
        if (RSTART > 0) {
          ts = substr($0, RSTART+1, 17)
          if (ts >= t1 && $9 ~ /^5[0-9][0-9]$/) print $0
        }
      }
    ' "$NGINX_LOG" | head -2)
    send_alert "${COUNT_5XX} *5xx errors* in last minute (threshold: ${ALERT_THRESHOLD})%0A%0ASample:%0A\`\`\`%0A${SAMPLE}%0A\`\`\`"
  fi
else
  echo "$(date) [WARN] Nginx log not readable at $NGINX_LOG"
fi

# ===== Check 3: Direct health check on each PM2 port =====
DOWN_PORTS=""
for PORT in 4000 4001 4002 4003 4004 4005 4006 4007; do
  if ! curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/" 2>/dev/null; then
    DOWN_PORTS="$DOWN_PORTS $PORT"
  fi
done

if [ -n "$DOWN_PORTS" ]; then
  send_alert "Ports not responding: \`${DOWN_PORTS}\` — nginx will return 502 for these"
fi

# ===== Check 4: Facebook bot can still see the redirect domain =====
FB_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 \
  -A "facebookexternalhit/1.1" \
  https://breezysocial.com 2>/dev/null)

if [ "$FB_STATUS" != "200" ] && [ "$FB_STATUS" != "301" ] && [ "$FB_STATUS" != "302" ]; then
  send_alert "Facebook bot got HTTP *${FB_STATUS}* from breezysocial.com — boost links may break"
fi

echo "$(date) [OK] checks passed (5xx=$COUNT_5XX, offline_pm2=${OFFLINE:-none}, down_ports=${DOWN_PORTS:-none}, fb=$FB_STATUS)"
