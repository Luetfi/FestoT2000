# Festo Video Search

Semantische Videosuche für Festo Service-Techniker und Inbetriebnahme-Ingenieure. Die App durchsucht YouTube-Videosegmente mit präzisen Zeitstempeln, damit technische Probleme schnell gelöst werden können.

**Problem eingeben → passendes Videosegment finden → direkt zur richtigen Stelle springen.**

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Datenbank:** PostgreSQL 17 mit pgvector (HNSW-Index), Zugriff über `pg`
- **KI/Embeddings:** OpenAI `text-embedding-3-small` (1536 Dimensionen)
- **Suche:** Hybrid-Suche (BM25 + Vektor-Ähnlichkeit) mit Reciprocal Rank Fusion
- **APIs:** YouTube Data API v3 (nur zum Einlesen neuer Videos)
- **Deployment:** Docker-Image (Next.js standalone)

## Features

- **Hybrid-Suche** — Kombiniert semantische Vektor-Suche mit Volltext-Suche (BM25) für optimale Ergebnisse
- **KI-Bewertung** — Ein Sprachmodell bewertet die Treffer, wählt die Sprungstelle im Video und schlägt bei schwachen Ergebnissen bessere Suchbegriffe vor
- **Zweisprachig** — Deutsch und Englisch (Transkripte + UI)
- **Video-Segmentierung** — 30–60 Sekunden Segmente mit 15% Überlappung für präzise Treffer
- **Antwort-Panel** — KI-generierte Segment-Erklärungen
- **Dark Mode** — Umschaltbar über Theme-Toggle
- **Login Gate** — Optionaler Passwortschutz

## Voraussetzungen

- Node.js 20.9+
- Docker (für die lokale Datenbank und das Produktions-Image)
- [OpenAI](https://platform.openai.com) API Key
- [YouTube Data API](https://console.cloud.google.com) Key (optional, nur zum Einlesen neuer Videos)

## Setup

### 1. Repository klonen und Dependencies installieren

```bash
git clone <repo-url>
cd festot2000
npm install
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.local.example .env.local
```

Die Datei `.env.local` ausfüllen:

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindung (`postgresql://user:passwort@host:port/db`) |
| `OPENAI_API_KEY` | OpenAI API Key |
| `YOUTUBE_API_KEY` | YouTube Data API Key, optional: nur zum Einlesen neuer Videos nötig |
| `INGESTION_SECRET` | Secret für Ingestion-Endpunkte |
| `CRON_SECRET` | Secret für Cron-Jobs |
| `AUTH_USERNAME` | Login-Benutzername |
| `AUTH_PASSWORD` | Login-Passwort |
| `AUTH_SECRET` | Session-Secret (`openssl rand -hex 32`) |

Optional:

| Variable | Beschreibung |
|---|---|
| `DATABASE_SSL_CA` | Pfad zu einem CA-Bündel: verschlüsselte Verbindung mit Zertifikatsprüfung (Amazon RDS) |
| `DATABASE_SSL` | `require`: verschlüsselt ohne Zertifikatsprüfung |
| `CHANNEL_ALLOWLIST` | Kommagetrennte Kanal-Namen (als offiziell markiert) |
| `CHANNEL_BLOCKLIST` | Kommagetrennte Kanal-Namen (blockiert) |

### 3. Datenbank einrichten

Lokal läuft PostgreSQL 17 mit pgvector als Docker-Container (Port 55433, nur auf localhost erreichbar):

```bash
docker run -d --name festo-video-search-db -e POSTGRES_USER=festo -e POSTGRES_PASSWORD=<passwort> -e POSTGRES_DB=festo_video_search -p 127.0.0.1:55433:5432 -v festo-video-search-pgdata:/var/lib/postgresql/data pgvector/pgvector:pg17
```

Schema einspielen:

```bash
docker exec -i festo-video-search-db psql -U festo -d festo_video_search -v ON_ERROR_STOP=1 < db/schema.sql
```

`db/schema.sql` erstellt die Tabellen (Channels → Videos → Transcripts → Segments, Feedback, Suchprotokoll), aktiviert pgvector und legt die Suchfunktionen an.

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Die App läuft unter [http://localhost:3000](http://localhost:3000).

## Datenbank befüllen (Ingestion)

Die Datenbank ist initial leer. Videos werden über die Ingestion-Pipeline indiziert:

**Einzelnes Video:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $INGESTION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "VIDEO_ID"}'
```

**Batch:**
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $INGESTION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"videoIds": ["VIDEO_ID_1", "VIDEO_ID_2"]}'
```

**Ganzen Kanal:**
```bash
curl -X POST http://localhost:3000/api/ingest/channel \
  -H "Authorization: Bearer $INGESTION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"channelId": "CHANNEL_ID"}'
```

**Automatisch via Cron:** Der Endpunkt `/api/cron/seed-videos` durchsucht 24 Seed-Queries nach neuen Festo-Videos.

## Ingestion-Pipeline

```
YouTube Video
  → Metadaten abrufen (YouTube Data API)
  → Transkript laden (DE → EN Fallback)
  → In 30–60s Segmente aufteilen (15% Überlappung)
  → Embeddings generieren (OpenAI)
  → In PostgreSQL speichern (pgvector)
```

## Betrieb mit Docker

Für den Serverbetrieb baut das `Dockerfile` ein eigenständiges Image (Next.js `standalone`):

```bash
docker build -t festo-video-search .
docker run -d -p 3000:3000 --env-file .env.production festo-video-search
```

Die Konfiguration kommt vollständig aus Umgebungsvariablen (Vorlage: `.env.local.example`). Für Amazon RDS `DATABASE_SSL_CA=/app/certs/rds-global-bundle.pem` setzen, das Zertifikatsbündel ist im Image enthalten. Das Login-Cookie wird im Produktionsbetrieb nur über HTTPS gesendet, die App gehört also hinter einen HTTPS-Endpunkt.

Auf dem Server (EC2, Amazon Linux 2023, Code unter `~/app`) übernehmen das die Skripte unter `deploy/`:

| Skript | Zweck |
|---|---|
| `deploy/create-env.sh` | Konfiguration `~/app.env` anlegen, Geheimnisse und Login-Passwörter werden erzeugt |
| `deploy/init-db.sh` | `db/schema.sql` einmalig in die leere RDS-Datenbank einspielen |
| `deploy/update.sh` | neuesten Stand von GitHub holen, Image bauen, App neu starten |

Neue Kanalvideos holt `/api/cron/sync-channels` (Aufruf mit `Authorization: Bearer $CRON_SECRET`), ein Zeitplaner ist nicht eingerichtet.

## Scripts

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Entwicklungsserver starten |
| `npm run build` | Produktions-Build erstellen |
| `npm start` | Produktionsserver starten |
| `npm run lint` | ESLint ausführen |

## Projektstruktur

```
src/
├── app/
│   ├── (main)/              # Haupt-UI (Home, Suche, Video-Detail)
│   ├── api/
│   │   ├── search/          # Hybrid-Suche Endpunkt
│   │   ├── ingest/          # Video-Ingestion (einzeln, batch, Kanal)
│   │   ├── cron/            # Automatische Indexierung
│   │   └── auth/            # Login / Logout
│   └── login/               # Login-Seite
├── lib/
│   ├── search/              # Query-Parser, Enrichment, Relevanz-Filter
│   ├── ingestion/           # Pipeline, Chunker, Seed-Queries
│   ├── openai/              # Embeddings & Summaries
│   ├── youtube/             # YouTube API Client, Transkripte
│   ├── db/                  # PostgreSQL-Zugriff & Typen
│   └── dictionaries/        # i18n (de.json, en.json)
├── components/
│   ├── search/              # Suchfeld, Suchvorschläge
│   ├── results/             # Ergebnisliste, Ergebnis-Karten
│   ├── video/               # YouTube-Player, Kapitel, Antwort-Panel
│   └── ui/                  # shadcn/ui Basis-Komponenten
└── types/                   # TypeScript-Typen

db/
└── schema.sql               # Datenbank-Schema (PostgreSQL + pgvector)

deploy/                      # Betriebsskripte für den EC2-Server
```

## Lizenz

Proprietär — Festo SE & Co. KG
