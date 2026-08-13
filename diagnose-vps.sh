echo "--- NGINX CONFIG ---"
cat /etc/nginx/sites-enabled/adspx || echo "Config not found in sites-enabled"
echo "--- PORT LISTENERS ---"
sudo ss -tulpn | grep -E ":3000|:4000"
echo "--- PM2 STATUS ---"
pm2 status
echo "--- PM2 LOGS ---"
pm2 logs adspx --lines 20 --no-daemon & sleep 5 && kill $!
