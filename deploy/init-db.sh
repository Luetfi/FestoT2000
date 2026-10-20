#!/bin/bash
# Spielt db/schema.sql in die leere RDS-Datenbank ein. Nur einmal ausfuehren.
#
#   bash ~/app/deploy/init-db.sh
set -euo pipefail

APP_DIR="$HOME/app"
ENV_FILE="$HOME/app.env"
CA_FILE="$HOME/rds-global-bundle.pem"

DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
curl -fsS -o "$CA_FILE" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# psql aus dem offiziellen PostgreSQL-Image, verschluesselt und mit
# Zertifikatspruefung gegen RDS.
sudo docker run --rm -i -v "$CA_FILE:/ca.pem:ro" postgres:17-alpine \
  psql "${DATABASE_URL}?sslmode=verify-full&sslrootcert=/ca.pem" -v ON_ERROR_STOP=1 -q \
  < "$APP_DIR/db/schema.sql"

echo "Schema eingespielt."
