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

# Das Browser-Terminal von EC2 Instance Connect fuegt Text je nach Einfuegeweg
# doppelt ein. Eine Eingabe, die exakt aus zwei gleichen Haelften besteht, wird
# deshalb auf eine Haelfte gekuerzt - bei echten Schluesseln kommt das nicht vor.
# Ausgegeben wird nur die Laenge, nie der Inhalt.
ask() {
  local prompt="$1" secret="$2" value n
  if [ "$secret" = 1 ]; then
    read -r -s -p "$prompt (Eingabe unsichtbar): " value; echo >&2
  else
    read -r -p "$prompt: " value
  fi
  n=${#value}
  if [ "$n" -gt 0 ] && [ $((n % 2)) -eq 0 ] && [ "${value:0:n/2}" = "${value:n/2}" ]; then
    value="${value:0:n/2}"
    echo "   -> doppelt eingefuegt, korrigiert auf ${#value} Zeichen" >&2
  else
    echo "   -> ${n} Zeichen" >&2
  fi
  printf '%s' "$value"
}

DB_HOST=$(ask "Datenbank-Endpunkt (z. B. festo-video-search-db.xxxx.eu-central-1.rds.amazonaws.com)" 0)
DB_PASSWORD=$(ask "Datenbank-Passwort" 1)

# Sonderzeichen im Passwort duerfen die Verbindungs-URL nicht zerlegen.
DB_PASSWORD_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_PASSWORD")

random_password() { openssl rand -base64 18 | tr -d '/+=' | cut -c1-20; }

umask 077
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://festo:${DB_PASSWORD_ENC}@${DB_HOST}:5432/festovideosearch
DATABASE_SSL_CA=/app/certs/rds-global-bundle.pem
# Nur zum Einlesen neuer Videos noetig (optional):
# YOUTUBE_API_KEY=
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
