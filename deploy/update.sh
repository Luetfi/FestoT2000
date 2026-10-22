#!/bin/bash
# Holt den aktuellen Stand von GitHub, baut das Image neu und startet die App.
# Fuer den ersten Start und fuer jedes spaetere Update.
#
#   bash ~/app/deploy/update.sh
set -euo pipefail

APP_DIR="$HOME/app"
ENV_FILE="$HOME/app.env"
NAME=festo-video-search

cd "$APP_DIR"
git pull --ff-only

sudo docker build -t "$NAME" .

sudo docker rm -f "$NAME" >/dev/null 2>&1 || true
# Port 80 ist ueber die Sicherheitsgruppe nur fuer CloudFront offen.
sudo docker run -d --name "$NAME" --restart unless-stopped \
  -p 80:3000 --env-file "$ENV_FILE" "$NAME"

# Alte, nicht mehr benutzte Images aufraeumen, damit die Platte nicht volllaeuft.
sudo docker image prune -f >/dev/null

sleep 3
curl -fsS http://localhost/api/health && echo
