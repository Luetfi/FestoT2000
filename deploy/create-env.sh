#!/bin/bash
# Legt die Konfiguration der App auf dem Server an (~/app.env).
#
# Fragt nur ab, was von aussen kommt (Datenbank, API-Schluessel). Alle internen
# Geheimnisse und die Login-Passwoerter werden zufaellig erzeugt. Geheime
# Eingaben erscheinen nicht auf dem Bildschirm.
#
#   bash ~/app/deploy/create-env.sh
set -euo pipefail

ENV_FILE="$HOME/app.env"
if [ -e "$ENV_FILE" ]; then
  echo "$ENV_FILE existiert bereits. Zum Neuanlegen zuerst loeschen: rm $ENV_FILE"
  exit 1
fi

read -r -p "Datenbank-Endpunkt (z. B. festo-video-search-db.xxxx.eu-central-1.rds.amazonaws.com): " DB_HOST
read -r -s -p "Datenbank-Passwort (Eingabe unsichtbar): " DB_PASSWORD; echo
read -r -s -p "OpenAI-API-Key (Eingabe unsichtbar): " OPENAI_API_KEY; echo
read -r -s -p "YouTube-API-Key (Eingabe unsichtbar): " YOUTUBE_API_KEY; echo

# Sonderzeichen im Passwort duerfen die Verbindungs-URL nicht zerlegen.
DB_PASSWORD_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_PASSWORD")

random_password() { openssl rand -base64 18 | tr -d '/+=' | cut -c1-20; }

umask 077
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://festo:${DB_PASSWORD_ENC}@${DB_HOST}:5432/festovideosearch
DATABASE_SSL_CA=/app/certs/rds-global-bundle.pem
OPENAI_API_KEY=${OPENAI_API_KEY}
YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
INGESTION_SECRET=$(openssl rand -hex 24)
CRON_SECRET=$(openssl rand -hex 24)
AUTH_USERNAME=team
AUTH_PASSWORD=$(random_password)
AUTH_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=FestoAdmin
ADMIN_PASSWORD=$(random_password)
MONITORED_CHANNEL_IDS=UCswhE6URzxILULeMYqOC1Cg
EOF

echo
echo "Gespeichert in $ENV_FILE (nur fuer ec2-user lesbar)."
echo "Login-Daten fuer die App anzeigen:  grep -E '^(AUTH|ADMIN)_(USERNAME|PASSWORD)=' $ENV_FILE"
