#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/Traffic/traffic-app"
URL="https://traffic.tokentap.ca/"

cd "$APP_DIR"

echo "== git status before deploy =="
git status --short --branch

echo
echo "== build gate =="
npm run build

echo
echo "== restart traffic-web =="
systemctl restart traffic-web.service
sleep 8

echo
echo "== service status =="
systemctl status traffic-web.service --no-pager -l | sed -n '1,80p'

echo
echo "== public smoke =="
curl -sS -m 15 -D- "$URL" -o /tmp/traffic-web-deploy-smoke.html | sed -n '1,15p'

echo
echo "== api smoke =="
curl -sS -m 10 https://traffic.tokentap.ca/api/healthz && echo

echo
echo "deploy complete"
