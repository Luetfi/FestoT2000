#!/bin/bash
# Kopiert alle Daten aus der bisherigen Supabase-Datenbank in die RDS-Datenbank.
#
# Voraussetzung: init-db.sh ist gelaufen (Schema steht). Vorhandene Daten in RDS
# werden vorher geleert, das Skript laesst sich also gefahrlos wiederholen.
# Supabase wird nur gelesen.
#
#   bash ~/app/deploy/migrate-from-supabase.sh
set -euo pipefail

ENV_FILE="$HOME/app.env"
CA_FILE="$HOME/rds-global-bundle.pem"
TABLES=(channels videos transcripts segments video_feedback query_log)

# Doppelt eingefuegte Eingaben kuerzen (Browser-Terminal), siehe create-env.sh.
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

echo "Supabase-Dashboard -> Connect -> Session pooler -> URI kopieren"
echo "(beginnt mit postgresql://postgres.  und enthaelt [YOUR-PASSWORD])."
SRC_TEMPLATE=$(ask "Supabase-URI" 0)
SRC_PASSWORD=$(ask "Supabase-Datenbankpasswort" 1)

SRC_PASSWORD_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$SRC_PASSWORD")
SRC_URL="${SRC_TEMPLATE/\[YOUR-PASSWORD\]/$SRC_PASSWORD_ENC}"
case "$SRC_URL" in *\?*) SRC_URL="${SRC_URL}&sslmode=require" ;; *) SRC_URL="${SRC_URL}?sslmode=require" ;; esac

DST_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)?sslmode=verify-full&sslrootcert=/ca.pem"
[ -f "$CA_FILE" ] || curl -fsS -o "$CA_FILE" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

TABLE_ARGS=""
for t in "${TABLES[@]}"; do TABLE_ARGS="$TABLE_ARGS -t public.$t"; done
TABLE_LIST=$(IFS=,; echo "${TABLES[*]}")

# Zaehlt die Zeilen aller Tabellen, um Quelle und Ziel zu vergleichen.
COUNT_SQL=""
for t in "${TABLES[@]}"; do
  COUNT_SQL="$COUNT_SQL SELECT '$t' AS tabelle, count(*) AS zeilen FROM $t UNION ALL"
done
COUNT_SQL="${COUNT_SQL% UNION ALL};"

# Seriennummern hinter die hoechste uebernommene id setzen, damit neue Zeilen
# nicht mit uebernommenen kollidieren.
SEQ_SQL=""
for t in "${TABLES[@]}"; do
  SEQ_SQL="$SEQ_SQL SELECT setval(pg_get_serial_sequence('$t', 'id'), COALESCE((SELECT max(id) FROM $t), 0) + 1, false);"
done

run() {
  sudo docker run --rm -i -v "$CA_FILE:/ca.pem:ro" -e SRC_URL -e DST_URL postgres:17-alpine sh -c "$1"
}
export SRC_URL DST_URL

echo
echo "== Supabase (Quelle) =="
run "psql \"\$SRC_URL\" -X -c \"$COUNT_SQL\""

echo "== Kopieren =="
run "set -e
  psql \"\$DST_URL\" -X -q -v ON_ERROR_STOP=1 -c 'TRUNCATE $TABLE_LIST RESTART IDENTITY CASCADE;'
  pg_dump \"\$SRC_URL\" --data-only --no-owner --no-privileges $TABLE_ARGS \
    | psql \"\$DST_URL\" -X -q -v ON_ERROR_STOP=1 >/dev/null
  psql \"\$DST_URL\" -X -q -v ON_ERROR_STOP=1 -c \"$SEQ_SQL\" >/dev/null
  psql \"\$DST_URL\" -X -q -c 'ANALYZE;'"

echo "== AWS RDS (Ziel) =="
run "psql \"\$DST_URL\" -X -c \"$COUNT_SQL\""
echo "Fertig. Beide Tabellen oben muessen dieselben Zeilenzahlen zeigen."
