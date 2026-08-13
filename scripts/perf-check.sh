#!/usr/bin/env bash
# One-click performance check for sleepox.com
# Runs Lighthouse + captures slowest network requests via Chrome DevTools Protocol
# Usage: ./scripts/perf-check.sh [URL]
#   default URL: https://sleepox.com

set -e

URL="${1:-https://sleepox.com}"
OUT_DIR="/tmp/perf-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

echo "=========================================="
echo "  Performance Check"
echo "  URL: $URL"
echo "  Output: $OUT_DIR"
echo "=========================================="

# --- Step 1: install lighthouse + chrome if missing ---
if ! command -v lighthouse >/dev/null 2>&1; then
  echo ">>> Installing lighthouse globally (one-time)..."
  npm install -g lighthouse >/dev/null 2>&1
fi

if ! command -v google-chrome >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
  echo ">>> Installing chromium (one-time)..."
  apt-get update -qq && apt-get install -y -qq chromium-browser >/dev/null 2>&1 || \
  apt-get install -y -qq chromium >/dev/null 2>&1
fi

CHROME_BIN=$(command -v google-chrome || command -v chromium-browser || command -v chromium)
echo ">>> Chrome: $CHROME_BIN"

# --- Step 2: Run Lighthouse (mobile + desktop) ---
echo ""
echo ">>> Running Lighthouse (mobile)..."
lighthouse "$URL" \
  --output=html --output=json \
  --output-path="$OUT_DIR/mobile" \
  --chrome-flags="--headless --no-sandbox --disable-gpu" \
  --preset=perf \
  --quiet 2>/dev/null || echo "mobile lighthouse failed"

echo ">>> Running Lighthouse (desktop)..."
lighthouse "$URL" \
  --output=html --output=json \
  --output-path="$OUT_DIR/desktop" \
  --chrome-flags="--headless --no-sandbox --disable-gpu" \
  --preset=desktop \
  --quiet 2>/dev/null || echo "desktop lighthouse failed"

# --- Step 3: Parse slowest requests from lighthouse JSON ---
echo ""
echo "=========================================="
echo "  📊 SCORES"
echo "=========================================="
for mode in mobile desktop; do
  JSON="$OUT_DIR/${mode}.report.json"
  if [ -f "$JSON" ]; then
    node -e "
      const r = require('$JSON');
      const cat = r.categories.performance;
      const a = r.audits;
      console.log('--- ${mode^^} ---');
      console.log('Performance Score : ' + Math.round(cat.score*100) + '/100');
      console.log('FCP   : ' + a['first-contentful-paint'].displayValue);
      console.log('LCP   : ' + a['largest-contentful-paint'].displayValue);
      console.log('TBT   : ' + a['total-blocking-time'].displayValue);
      console.log('CLS   : ' + a['cumulative-layout-shift'].displayValue);
      console.log('Speed : ' + a['speed-index'].displayValue);
      console.log('TTI   : ' + a['interactive'].displayValue);
      console.log('');
    "
  fi
done

echo "=========================================="
echo "  🐌 TOP 15 SLOWEST REQUESTS (mobile)"
echo "=========================================="
JSON="$OUT_DIR/mobile.report.json"
if [ -f "$JSON" ]; then
  node -e "
    const r = require('$JSON');
    const items = (r.audits['network-requests'].details && r.audits['network-requests'].details.items) || [];
    items.sort((a,b)=>(b.endTime-b.startTime)-(a.endTime-a.startTime));
    console.log('Time(ms) | Size(KB) | Type        | URL');
    console.log('---------|----------|-------------|----');
    items.slice(0,15).forEach(it=>{
      const dur = Math.round(it.endTime - it.startTime);
      const kb  = Math.round((it.transferSize||0)/1024);
      const type = (it.resourceType||'').padEnd(11);
      const url = (it.url||'').slice(0,80);
      console.log(String(dur).padStart(8) + ' | ' + String(kb).padStart(8) + ' | ' + type + ' | ' + url);
    });
  "
fi

echo ""
echo "=========================================="
echo "  ⚠️  TOP OPPORTUNITIES (mobile)"
echo "=========================================="
if [ -f "$JSON" ]; then
  node -e "
    const r = require('$JSON');
    const opps = Object.values(r.audits).filter(a=>a.details && a.details.type==='opportunity' && a.numericValue>0);
    opps.sort((a,b)=>b.numericValue-a.numericValue);
    opps.slice(0,8).forEach(a=>{
      console.log('• ' + a.title + '  →  saves ~' + Math.round(a.numericValue) + 'ms');
    });
  "
fi

echo ""
echo "=========================================="
echo "  ✅ DONE"
echo "  Mobile  report: $OUT_DIR/mobile.report.html"
echo "  Desktop report: $OUT_DIR/desktop.report.html"
echo ""
echo "  Download to laptop to view:"
echo "    scp root@75.119.144.171:$OUT_DIR/mobile.report.html ~/Downloads/"
echo "=========================================="
