# Festo Video Search

Semantische Videosuche für Festo Service-Techniker und Inbetriebnahme-Ingenieure. Die App durchsucht YouTube-Videosegmente mit präzisen Zeitstempeln, damit technische Probleme schnell gelöst werden können.

**Problem eingeben → passendes Videosegment finden → direkt zur richtigen Stelle springen.**

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Datenbank:** Supabase PostgreSQL mit pgvector (HNSW-Index)
- **KI/Embeddings:** OpenAI `text-embedding-3-small` (1536 Dimensionen)
- **Suche:** Hybrid-Suche (BM25 + Vektor-Ähnlichkeit) mit Reciprocal Rank Fusion
- **APIs:** YouTube Data API v3, Upstash Redis (Rate Limiting)
- **Deployment:** Vercel

## Features

- **Hybrid-Suche** — Kombiniert semantische Vektor-Suche mit Volltext-Suche (BM25) für optimale Ergebnisse
- **Query Enhancement** — Automatische Erkennung von Fehlercodes (E123, E-7342) und Festo-Produkten (CPX, CMMT-AS, VTUG)
- **Zweisprachig** — Deutsch und Englisch (Transkripte + UI)
- **Video-Segmentierung** — 30–60 Sekunden Segmente mit 15% Überlappung für präzise Treffer
- **Antwort-Panel** — KI-generierte Segment-Erklärungen
- **Dark Mode** — Umschaltbar über Theme-Toggle
- **Rate Limiting** — 10 Anfragen / 10 Sekunden pro IP
- **Login Gate** — Optionaler Passwortschutz

## Voraussetzungen

- Node.js 18+
- [Supabase](https://supabase.com)-Projekt mit pgvector-Extension
- [OpenAI](https://platform.openai.com) API Key
- [YouTube Data API](https://console.cloud.google.com) Key
- [Upstash Redis](https://upstash.com) (für Rate Limiting)

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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_SECRET` | Supabase Service Role Key |
| `OPENAI_API_KEY` | OpenAI API Key |
| `YOUTUBE_API_KEY` | YouTube Data API Key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Token |
| `INGESTION_SECRET` | Secret für Ingestion-Endpunkte |
| `CRON_SECRET` | Secret für Cron-Jobs |
| `AUTH_USERNAME` | Login-Benutzername |
| `AUTH_PASSWORD` | Login-Passwort |
| `AUTH_SECRET` | Session-Secret (`openssl rand -hex 32`) |

Optional:

| Variable | Beschreibung |
|---|---|
| `CHANNEL_ALLOWLIST` | Kommagetrennte Kanal-Namen (als offiziell markiert) |
| `CHANNEL_BLOCKLIST` | Kommagetrennte Kanal-Namen (blockiert) |

### 3. Datenbank einrichten

Supabase-Migrationen anwenden:

```bash
supabase migration up
```

Die Migrationen erstellen das Schema (Channels → Videos → Transcripts → Segments), aktivieren pgvector, und legen die Hybrid-Search-Funktion an.

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
  → In Supabase speichern (pgvector)
```

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
│   ├── supabase/            # DB-Clients & Typen
│   └── dictionaries/        # i18n (de.json, en.json)
├── components/
│   ├── search/              # Suchfeld, Quick-Filter
│   ├── results/             # Ergebnisliste, Ergebnis-Karten
│   ├── video/               # YouTube-Player, Kapitel, Antwort-Panel
│   └── ui/                  # shadcn/ui Basis-Komponenten
└── types/                   # TypeScript-Typen

supabase/
└── migrations/              # Datenbank-Schema (5 Migrationen)
```

## Architektur

Detaillierte Architektur-Dokumentation unter [`docs/architecture.md`](docs/architecture.md).

## Lizenz

Proprietär — Festo SE & Co. KG
