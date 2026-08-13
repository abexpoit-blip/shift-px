#!/usr/bin/env bash
echo "🔍 Checking if app is listening on 4000..."
if ! sudo ss -tulpn | grep -q ":4000"; then
  echo "⚠️ App is NOT listening on port 4000. Checking PM2 logs..."
  pm2 logs sleepox --lines 50 --no-daemon & sleep 5 && kill $!
  exit 1
fi

echo "✅ App is listening on 4000. Updating Nginx..."
sudo sed -i 's/127.0.0.1:3000/127.0.0.1:4000/g' /etc/nginx/sites-available/sleepox
sudo sed -i 's/localhost:3000/127.0.0.1:4000/g' /etc/nginx/sites-available/sleepox
sudo systemctl restart nginx
echo "🚀 Nginx restarted. Testing website..."
curl -I http://127.0.0.1:4000/login
