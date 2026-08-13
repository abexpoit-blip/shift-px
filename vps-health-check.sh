echo "=== Port 4000 Check ==="
sudo ss -tulpn | grep :4000 || echo "Nothing listening on 4000"

echo "=== PM2 Logs (last 20 lines) ==="
pm2 logs sleepox --lines 20 --no-daemon & sleep 5 && kill $!

echo "=== Nginx Config Check ==="
cat /etc/nginx/sites-enabled/sleepox | grep -C 5 "proxy_pass"

echo "=== Local Connectivity Check ==="
curl -I http://127.0.0.1:4000/login || echo "Local curl failed"
