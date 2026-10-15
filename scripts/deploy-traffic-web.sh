#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/Traffic/traffic-app"
URL="https://traffic.tokentap.ca/"

cd "$APP_DIR"

# This legacy helper only supports checkout-backed releases. The verified
# 2026-10-15 production service uses a versioned release directory on the
# mounted volume; rebuilding this checkout would NOT update that active build.
ACTIVE_DIR="$(systemctl show traffic-web.service --property=WorkingDirectory --value --no-pager)"
if [[ "$ACTIVE_DIR" != "$APP_DIR" ]]; then
  echo "STOP: traffic-web serves '$ACTIVE_DIR', not '$APP_DIR'." >&2
  echo "Do not rebuild the inactive checkout or claim it was deployed." >&2
  echo "Use the staged-release procedure in docs/TRAFFIC_RELEASE_2026-10-15.md." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: dirty web checkout; refusing legacy deployment." >&2
  exit 1
fi

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
