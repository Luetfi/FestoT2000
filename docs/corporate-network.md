# Betrieb hinter einem Firmen-Proxy (Zscaler & Co.)

Die App läuft auf einem privaten Rechner problemlos, auf einem verwalteten
Firmenlaptop dagegen nicht: Supabase, OpenAI und teils auch die Deployment-Domain
werden von einem Secure-Web-Gateway abgefangen. Dieses Dokument beschreibt, wie
man die Ursache eingrenzt und welche Auswege es gibt.

## Was die App nach außen braucht

Wichtig für das Verständnis: `src/lib/supabase/client.ts` wird nirgends
importiert. Der Browser spricht **nie** direkt mit Supabase oder OpenAI — alle
externen Aufrufe passieren serverseitig in den API-Routes. Der Netzbedarf
verteilt sich also so:

| Host | Ebene | Wofür | Kritisch für |
|---|---|---|---|
| `api.openai.com` | Node | Embedding pro Query, LLM-Judge, Query-Suggester | Suche |
| `epdtzrsgukrxecaitlzy.supabase.co` | Node | `hybrid_search_segments`-RPC, alle Tabellen | Suche |
| `www.googleapis.com` | Node | YouTube Data API | nur Ingestion / Cron |
| `registry.npmjs.org` | Node | `npm install` | nur Setup |
| `www.youtube.com` | Browser | Player-iframe (`react-youtube`) | Video-Wiedergabe |
| `i.ytimg.com` | Browser | Thumbnails (`next.config.ts` → `remotePatterns`) | Vorschaubilder |

Daraus folgt: solange der **Node-Prozess** rauskommt, funktioniert die Anwendung
— unabhängig davon, was der Browser darf. Die einzige Browser-Abhängigkeit, die
sich nicht ersetzen lässt, ist YouTube selbst.

## Vorab: läuft das Supabase-Projekt überhaupt?

Ein pausiertes Supabase-Projekt veröffentlicht seine Subdomain nicht mehr — der
Name löst dann auf **keinem** Rechner mehr auf, mit oder ohne Proxy. Der Fehler
(`ENOTFOUND`) sieht einem DNS-Sinkhole des Gateways täuschend ähnlich und führt
leicht auf die falsche Spur.

Der Free-Tier pausiert nach etwa einer Woche ohne Zugriff automatisch.
Reaktivieren im Supabase-Dashboard über **Resume** — das dauert ein bis zwei
Minuten. Das Diagnose-Skript weist diesen Fall separat als `DNS` aus, damit er
nicht als Filter-Problem missverstanden wird.

## Zwei Ursachen, die man nicht verwechseln darf

**Fall A — TLS-Interception.** Das Gateway bricht HTTPS auf und signiert mit
einer eigenen Root-CA. Diese liegt im Windows-Zertifikatsspeicher, deshalb
funktioniert der Browser. Node.js bringt seinen *eigenen* CA-Store mit und kennt
sie nicht. Typische Fehlercodes: `SELF_SIGNED_CERT_IN_CHAIN`,
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Das ist
der häufigste Grund für "läuft privat, nicht auf Arbeit" — und **ohne IT
lösbar**.

**Fall B — URL-Filter.** Eine Kategorie- oder Reputationsregel blockiert die
Domain. Dann bekommt auch der Browser eine Block-Seite oder der DNS-Name landet
in einem Sinkhole. Hier hilft nur Whitelisting oder ein lokaler Ersatz.

## Ausführung auf einem verwalteten Laptop

**Voraussetzung.** Node.js muss installiert sein (`node --version`, erwartet wird
20+). Ist `registry.npmjs.org` gesperrt, scheitert `npm install` — dann den
Ordner `node_modules` vom funktionierenden Rechner mitkopieren. Das geht, solange
beide Rechner Windows x64 fahren.

**Transfer.** Es genügen die beiden `.ps1`-Dateien aus `scripts/`. Sie
funktionieren auch als Einzeldateien außerhalb des Repos: der Supabase-Host wird
dann nicht aus `.env.local` gelesen, sondern aus einer Fallback-Konstante im
Skript. Die Ausgabe unter "Umgebung" zeigt, welche Quelle gegriffen hat.

**Ausgabe mitschreiben**, damit sie sich zur Auswertung übertragen lässt:

```powershell
powershell -ExecutionPolicy Bypass -File .\diagnose-network.ps1 > diagnose.txt
notepad diagnose.txt
```

**Wenn die Ausführungsrichtlinie per Gruppenrichtlinie gesperrt ist.** Ein
`-ExecutionPolicy Bypass` auf der Kommandozeile wird von einer
GPO-Richtlinie (`MachinePolicy`/`UserPolicy`) überstimmt — erkennbar an
`Get-ExecutionPolicy -List`. Dann den Skriptinhalt an die Shell übergeben,
statt die Datei auszuführen; das unterliegt der Datei-Richtlinie nicht:

```powershell
Start-Transcript -Path diagnose.txt
Get-Content .\diagnose-network.ps1 -Raw | Invoke-Expression
Stop-Transcript
```

## Schritt 1: Diagnose

Auf dem Firmenlaptop, im Projektverzeichnis:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\diagnose-network.ps1
```

Das Skript liest den Supabase-Host aus `.env.local` und prüft jeden Ziel-Host auf
vier Ebenen — DNS, TLS-Aussteller (verrät die Interception), `curl.exe`
(Windows-Zertifikatsspeicher, wie der Browser) und `node` (eigener CA-Store).
Pro Host fällt ein Verdikt:

| Verdikt | Bedeutung | Nächster Schritt |
|---|---|---|
| `OK` | beide Ebenen erreichen den Host | nichts |
| `FALL A` | Browser ja, Node nein, Zertifikatsfehler | `setup-corporate-ca.ps1` |
| `FALL B` | Block-Seite oder Verbindung abgewiesen | Abschnitt "Fall B" |
| `DNS` | Name löst nicht auf | Supabase-Projekt prüfen, sonst Sinkhole |

`HTTP 401` von OpenAI und Supabase ist dabei der **Erfolgsfall**: die Verbindung
steht, es fehlt nur der API-Key im Testaufruf.

Manuell noch prüfen: lässt sich `https://www.youtube.com` im Browser öffnen? Ohne
YouTube-Zugriff liefert die Suche Treffer, aber kein Video spielt.

## Schritt 2 bei Fall A: CA-Bundle für Node

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-corporate-ca.ps1
```

Das Skript

0. prüft zuerst, ob Node der Zertifikatskette überhaupt misstraut. Tut es das
   nicht, bricht es ab statt legitime öffentliche Zwischenzertifikate zu
   exportieren (`-Force` übergeht das),
1. durchsucht den Windows-Zertifikatsspeicher nach CAs bekannter
   Inspektions-Proxys,
2. baut zusätzlich einen echten TLS-Handshake gegen `api.openai.com` auf und
   exportiert die dabei präsentierte Kette — damit werden auch Gateways erfasst,
   deren Name nicht im Suchmuster steht,
3. schreibt beides dedupliziert nach `%USERPROFILE%\.certs\corporate-ca.pem`,
4. setzt `NODE_EXTRA_CA_CERTS` als User-Umgebungsvariable,
5. testet OpenAI, npm und Supabase direkt gegen.

Mit `-WhatIf` läuft es als Trockenübung. `NODE_EXTRA_CA_CERTS` **ergänzt** den
Node-Store, ersetzt ihn nicht — öffentliche Zertifikate bleiben gültig. Weil npm,
`next` und alle `tsx`-Skripte auf Node laufen, übernehmen sie die Variable
automatisch; ein `npm config set cafile` ist unnötig und wäre restriktiver, weil
es den CA-Satz *ersetzt*.

**Danach Terminal und VS Code neu starten.** Die Variable wird nur beim
Prozessstart gelesen — ein laufender `next dev` sieht sie nicht.

Falls andere Tools ebenfalls stolpern:

```powershell
git config --global http.sslCAInfo "$env:USERPROFILE\.certs\corporate-ca.pem"
```

Das PEM liegt absichtlich außerhalb des Repos. `*.pem` steht ohnehin in
`.gitignore`, aber Firmen-Zertifikate gehören grundsätzlich nicht in ein
Code-Repository.

## Schritt 2 bei Fall B: gefilterte Domains

### Option 1 — eigene Domain statt `*.vercel.app`

`*.vercel.app` fällt bei vielen Gateways in eine pauschal gesperrte Kategorie
("Web Hosting", "Shared Hosting", teils auch Reputationsfilter für frei
registrierbare Subdomains). Eine Subdomain einer etablierten eigenen Domain wird
in der Regel durchgelassen.

Im Repo ist keine Domain hartcodiert (kein `NEXT_PUBLIC_SITE_URL`, keine
`VERCEL_URL`-Nutzung), der Wechsel ist daher rein eine DNS- und
Vercel-Konfiguration:

1. Vercel → Projekt `festot2000` → **Settings → Domains → Add**
2. `festo-video-search.webify-media.de` eintragen
3. Im DNS von `webify-media.de` einen CNAME setzen:

   ```
   festo-video-search   CNAME   cname.vercel-dns.com.
   ```

   (Für eine Apex-Domain wäre es stattdessen ein A-Record auf `76.76.21.21` —
   hier nicht nötig.)
4. Zertifikat wird von Vercel automatisch ausgestellt, dauert meist wenige
   Minuten.
5. Auf dem Firmenlaptop testen. Bleibt es blockiert, greift die Regel nicht auf
   die Domain, sondern auf Ziel-IP oder Hosting-ASN — dann hilft nur Option 2
   oder 3.

### Option 2 — Whitelist bei der IT beantragen

Der saubere, aber langsame Weg. Konkret anzufragen:

| Host | Begründung |
|---|---|
| `festo-video-search.webify-media.de` | Anwendung selbst |
| `api.openai.com` | Embedding-Modell `text-embedding-3-small`, LLM-Bewertung der Treffer |
| `epdtzrsgukrxecaitlzy.supabase.co` | Postgres/pgvector-Backend mit Volltext- und Vektorsuche |
| `www.youtube.com`, `i.ytimg.com` | Wiedergabe der indexierten Videos |

Hilfreich für den Antrag: es fließen keine personenbezogenen Daten ab, sondern
ausschließlich die eingegebene Suchanfrage (zur Vektorisierung) und
Transkript-Ausschnitte der öffentlichen YouTube-Videos.

### Option 3 — lokaler Stack ohne externe Aufrufe

Robust und netzunabhängig, Aufwand etwa ein halber Tag:

- **Datenbank:** `supabase start` (Supabase CLI, benötigt Docker) startet
  Postgres inklusive PostgREST lokal. Die REST-Schnittstelle ist identisch, es
  ändert sich **nur** `NEXT_PUBLIC_SUPABASE_URL` auf `http://127.0.0.1:54321`.
  Kein Code-Eingriff, die acht Migrationen unter `supabase/migrations/` laufen
  unverändert.
- **LLM und Embeddings:** Ollama antwortet OpenAI-kompatibel auf
  `http://localhost:11434/v1`. Nötig ist lediglich ein `baseURL` in den beiden
  Clients `src/lib/openai/{embeddings,summaries}.ts`.
- **Haken:** Die vorhandenen Vektoren stammen von `text-embedding-3-small` mit
  1536 Dimensionen. Ein anderes Modell erzeugt inkompatible Vektoren, der Korpus
  muss also einmalig neu eingebettet werden.
- **Transfer ohne Netz:** Re-Embedding und `docker pull` auf dem privaten Rechner
  erledigen, dann DB-Dump plus `docker save`-Archive per USB übertragen. Auf dem
  Firmenlaptop ist dann kein einziger Download mehr nötig.

### Option 4 — Offline-Demo-Modus als Absicherung

Für Präsentations- und Prüfungssituationen: die Ergebnisse einer festen Menge
Demo-Queries vorberechnen, als JSON ins Repo legen und hinter einem
`DEMO_MODE`-Flag ausliefern. Läuft ohne Netz, ohne Docker und ohne API-Keys.
Aufwand ein bis zwei Stunden. Empfehlenswert unabhängig davon, welche der
anderen Optionen greift — in einer Bewertungssituation will man keine
Netzabhängigkeit.

## Schnellreferenz

```powershell
# Diagnose
powershell -ExecutionPolicy Bypass -File scripts\diagnose-network.ps1

# Fall A beheben
powershell -ExecutionPolicy Bypass -File scripts\setup-corporate-ca.ps1

# Variable prüfen (nach Neustart des Terminals)
$env:NODE_EXTRA_CA_CERTS

# Einzelnen Host auf Node-Ebene nachtesten
node -e "fetch('https://api.openai.com/v1/models').then(r=>console.log(r.status)).catch(e=>console.log('ERR', e.cause?.code || e.message))"
```
