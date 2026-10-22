#!/bin/bash
# Einmalige Umstellung der Vektorsuche auf Amazon Titan Embeddings (1024 Werte).
#
# 1. Spalte segments.embedding auf vector(1024) umstellen (alte Vektoren werden
#    dabei geleert) - nur, wenn sie noch nicht umgestellt ist
# 2. alle Abschnitte ueber die App neu einbetten lassen (/api/ingest/reembed)
# 3. Suchindex neu aufbauen
#
# Vorher: Snapshot der Datenbank anlegen und die neue App-Version mit
# deploy/update.sh starten. Kann bei Abbruch einfach erneut gestartet werden.
#
#   bash ~/app/deploy/switch-to-bedrock.sh
set -euo pipefail

ENV_FILE="$HOME/app.env"
CA_FILE="$HOME/rds-global-bundle.pem"

DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
INGESTION_SECRET=$(grep '^INGESTION_SECRET=' "$ENV_FILE" | cut -d= -f2-)
[ -f "$CA_FILE" ] || curl -fsS -o "$CA_FILE" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
export DST_URL="${DATABASE_URL}?sslmode=verify-full&sslrootcert=/ca.pem"

psql_run() {
  sudo --preserve-env=DST_URL docker run --rm -i -v "$CA_FILE:/ca.pem:ro" -e DST_URL \
    postgres:17-alpine psql "$DST_URL" -X -q -v ON_ERROR_STOP=1 "$@"
}

read -r -p "Ist ein aktueller Snapshot der Datenbank angelegt? (ja/nein): " ANSWER
[ "$ANSWER" = "ja" ] || { echo "Abgebrochen. Erst Snapshot anlegen (RDS -> Datenbank -> Aktionen -> Snapshot erstellen)."; exit 1; }

echo "== 1) Spalte pruefen"
TYPE=$(psql_run -tA -c "SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'segments'::regclass AND attname = 'embedding'")
echo "   aktuell: $TYPE"
if [ "$TYPE" != "vector(1024)" ]; then
  echo "   stelle auf vector(1024) um ..."
  psql_run -c "BEGIN;
    DROP INDEX IF EXISTS segments_embedding_idx;
    ALTER TABLE segments ALTER COLUMN embedding TYPE vector(1024) USING NULL;
    COMMIT;"
else
  echo "   bereits umgestellt"
fi

echo "== 2) Abschnitte neu einbetten (dauert einige Minuten)"
for attempt in 1 2 3 4 5; do
  RESULT=$(curl -sS -m 1800 -X POST -H "Authorization: Bearer ${INGESTION_SECRET}" http://localhost/api/ingest/reembed || true)
  echo "   $RESULT"
  case "$RESULT" in *'"remaining":0'*) break ;; esac
  echo "   noch nicht fertig, neuer Versuch ($attempt) ..."
  sleep 5
done

echo "== 3) Suchindex aufbauen"
psql_run -c "CREATE INDEX IF NOT EXISTS segments_embedding_idx ON segments USING hnsw (embedding vector_cosine_ops); ANALYZE segments;"

psql_run -c "SELECT count(*) AS abschnitte, count(embedding) AS mit_vektor FROM segments;"
echo "Fertig. Beide Zahlen oben muessen gleich sein."
