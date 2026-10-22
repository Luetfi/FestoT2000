# Übergabe Festo Video Search

Stand: 22.10.2026, Lütfi Nteli Chalil (Praxisphase T2000)

Dieses Dokument beschreibt, wie die Video-Suche betrieben wird und was man für
Wartung, Updates und ein späteres Abschalten wissen muss. Wie die Anwendung
fachlich funktioniert und wie man sie lokal startet, steht in der `README.md`.

Ansprechpartner nach der Übergabe: Matthias Freund, Johannes Hoos.


## 1. Überblick

Die Anwendung läuft komplett im AWS-Konto **de-hq-tn-i.diy-finder-dev**
(Konto-ID 400200465832), Region **eu-central-1 (Frankfurt)**. Sie hängt an keinem
privaten Zugang und an keinem externen Dienst außer YouTube (Videoplayer und
Vorschaubilder werden direkt von YouTube geladen).

```
Browser ── https ──> CloudFront ── http ──> EC2 (Docker: Next.js-App) ──> RDS PostgreSQL
                                                  │
                                                  └── IAM-Rolle ──> Amazon Bedrock (Nova, Titan)
```

| Baustein | Name / ID | Zweck |
|---|---|---|
| CloudFront | `E24JUQAGTH351M`, Adresse `https://d323n9bi79butr.cloudfront.net` | öffentliche https-Adresse, leitet an den Server weiter |
| EC2 | `festo-video-search` (`i-00dbdf9ab2288bd5a`), t3.small, Amazon Linux 2023 | Server, auf dem die App als Docker-Container läuft |
| RDS | `festo-video-search-db`, PostgreSQL 17, db.t4g.micro, Datenbank `festovideosearch` | Videos, Abschnitte mit Vektoren, Feedback, Suchprotokoll |
| IAM-Rolle | `EC2InvokeBedrock` (am Server angehängt) | erlaubt dem Server, Bedrock aufzurufen |
| Bedrock | `eu.amazon.nova-2-lite-v1:0`, `amazon.titan-embed-text-v2:0` | Textfunktionen bzw. Vektoren für die Suche |
| Sicherheitsgruppen | `festo-video-search-app`, `ec2-rds-1`, `rds-ec2-1` | Firewall, siehe Abschnitt 6 |
| Netzwerk | Standard-VPC `vpc-049bf110c1fdd6672` | keine Anbindung ans Festo-Netz |

Der Quellcode liegt in GitLab: `https://gitlab.festo.company/lntc/festo-video-search`
(Projekt im persönlichen Bereich von lntc; Matthias Freund und Johannes Hoos sind
Maintainer).


## 2. Zugänge

**AWS-Konsole:** über das AWS-Zugriffsportal (festo.awsapps.com), Konto
de-hq-tn-i.diy-finder-dev. Für den Betrieb reicht die Rolle AWSPowerUserAccess.
Änderungen an IAM (Rollen, Policies) braucht Admin-Rechte.

**Server:** Es gibt kein SSH-Schlüsselpaar. Anmeldung über die Konsole:
EC2 → Instances → `festo-video-search` → Verbinden → Reiter „EC2 Instance
Connect" → Benutzer `ec2-user` → Verbinden. Es öffnet sich ein Terminal im Browser.

Achtung: Dieses Browser-Terminal fügt beim Einfügen mit der Maus Text gelegentlich
doppelt ein. Kurze Befehle besser abtippen, lange mit Strg+Umschalt+V einfügen und
vor Enter prüfen.

**Konfiguration der App:** `/home/ec2-user/app.env` auf dem Server (nur für
`ec2-user` lesbar). Darin stehen:

| Variable | Inhalt |
|---|---|
| `DATABASE_URL` | Verbindung zur RDS-Datenbank inkl. Passwort des Datenbankbenutzers `festo` |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | Login für die App (Benutzer `team`) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Login für den Adminbereich unter `/admin` (Benutzer `FestoAdmin`) |
| `AUTH_SECRET` | Schlüssel für die Login-Cookies |
| `INGESTION_SECRET`, `CRON_SECRET` | schützen die Endpunkte zum Einlesen von Videos |

Login-Daten anzeigen:

```bash
grep -E '^(AUTH|ADMIN)_(USERNAME|PASSWORD)=' ~/app.env
```

Nach einer Änderung an `app.env` muss die App neu gestartet werden
(`bash ~/app/deploy/update.sh`, siehe unten).

Für Bedrock gibt es keinen Schlüssel. Der Server meldet sich über die IAM-Rolle an.


## 3. Alltag

Alle Befehle im Server-Terminal.

**Läuft die App?**

```bash
sudo docker ps
curl -s localhost/api/health
```

Erwartet: Container `festo-video-search` mit Status „Up", und `"status":"healthy"`.

**Protokoll ansehen** (letzte 100 Zeilen):

```bash
sudo docker logs --tail 100 festo-video-search
```

Nur Suche und Bewertung:

```bash
sudo docker logs festo-video-search 2>&1 | grep -E "search|judge|picker" | tail -20
```

**App neu starten** (z. B. nach Änderung an `app.env`):

```bash
cd ~/app && bash deploy/update.sh
```

Das Skript holt den aktuellen Stand aus Git, baut das Docker-Image und startet den
Container neu. Erster Build 5 bis 10 Minuten, danach meist deutlich schneller. Der
Container startet nach einem Neustart des Servers automatisch.

**Bedrock-Zugriff prüfen:**

```bash
cd ~/app && bash deploy/check-bedrock.sh
```

Prüft Rolle, Titan, Nova, Zugriff aus dem Container und ob die Rolle eng genug ist.


## 4. Code ändern und ausrollen

1. Änderung im GitLab-Projekt einchecken (Branch `main`).
2. Auf dem Server: `cd ~/app && bash deploy/update.sh`

Der Server muss dafür lesend auf GitLab zugreifen können, siehe nächster Abschnitt.

### Updatequelle des Servers auf GitLab umstellen

Bei der Übergabe holte der Server den Code noch aus einem privaten GitHub-Repo
(Deploy Key). Umstellung auf GitLab:

1. Prüfen, ob GitLab vom Server erreichbar ist:
   ```bash
   curl -sI https://gitlab.festo.company | head -1
   ```
   Kommt eine Zeile mit `HTTP/... 200` oder `302`, geht es weiter. Kommt nichts
   oder ein Timeout, ist GitLab aus AWS nicht erreichbar; dann bleibt nur, Updates
   manuell auf den Server zu kopieren.
2. In GitLab: Projekt → Settings → Repository → **Deploy tokens** → Add token,
   Name `aws-server`, Scope nur `read_repository`. Benutzername und Token notieren.
3. Auf dem Server (Platzhalter ersetzen):
   ```bash
   cd ~/app
   git remote set-url origin https://<BENUTZER>:<TOKEN>@gitlab.festo.company/lntc/festo-video-search.git
   git fetch origin
   git checkout -B main origin/main
   ```
4. Test: `bash deploy/update.sh`
5. Alten GitHub-Schlüssel auf dem Server entfernen:
   ```bash
   rm ~/.ssh/github_deploy ~/.ssh/github_deploy.pub
   sed -i '/github.com/,/IdentitiesOnly/d' ~/.ssh/config
   ```


## 5. KI-Modelle

| Aufgabe | Modell |
|---|---|
| Vektoren für die Suche (1024 Werte) | Amazon Titan Text Embeddings V2, eu-central-1 |
| Bewertung der Treffer, Sprungstelle im Video, Zusammenfassungen, Erklärungen, Übersetzung der Anfrage, Suchvorschläge | Amazon Nova 2 Lite über das EU-Inference-Profil |

Die Anfragen bleiben in EU-Regionen. Das war Voraussetzung für die Freigabe.

**Modell wechseln:** In `app.env` eine Zeile ergänzen, z. B.

```
BEDROCK_CHAT_MODEL_ID=eu.amazon.nova-pro-v1:0
```

und die App neu starten. Vorher muss die Policy der Rolle `EC2InvokeBedrock` das
Modell erlauben: einen Eintrag für das Inference-Profil
(`arn:aws:bedrock:eu-central-1:400200465832:inference-profile/<modell>`) und einen
für das Modell in den EU-Regionen (`arn:aws:bedrock:eu-*::foundation-model/<modell ohne "eu.">`).
Prüfen mit `bash deploy/check-bedrock.sh <modell>`.

Claude-Modelle von Anthropic setzen ein einmaliges Formular zum Anwendungsfall
für das ganze AWS-Konto voraus; das wurde nicht ausgefüllt.

**Das Embedding-Modell** lässt sich nicht einfach tauschen: Alle gespeicherten
Vektoren hängen daran. Ein Wechsel heißt, die Spalte anzupassen und alle Abschnitte
neu einzubetten (Vorlage: `deploy/switch-to-bedrock.sh` und Endpunkt
`/api/ingest/reembed`).

**Bekannte Schwächen von Nova 2 Lite:**
- Bei langen Listen (60 Abschnitte) liefert es manchmal fehlerhaftes JSON. Die App
  liest die Bewertungen trotzdem einzeln heraus; im Protokoll steht dann
  `recovered from invalid JSON`.
- Es bewertet großzügig, oft 100 %. Die Reihenfolge der Treffer ist dadurch
  gröber als mit dem früheren OpenAI-Modell. Abhilfe wäre Nova Pro als Modell
  (Policy erweitern, siehe oben) oder eine strengere Bewertungsanweisung in
  `src/lib/search/relevance-judge.ts`.

Die Messwerte der Praxisarbeit wurden noch mit OpenAI-Modellen (gpt-4o-mini,
text-embedding-3-small) erhoben und gelten für den jetzigen Stand nicht unverändert.


## 6. Netzwerk und Sicherheit

- **festo-video-search-app** (Server): eingehend nur HTTP (80) von CloudFront
  (Präfixliste `pl-a3a144ca`) und SSH (22) von EC2 Instance Connect. Ausgehend alles.
- **rds-ec2-1 / ec2-rds-1**: von AWS beim Anlegen der Datenbank erzeugt. Nur der
  Server darf auf Port 5432 der Datenbank.
- Die Datenbank hat keine öffentliche Adresse, ist verschlüsselt und hat
  Löschschutz.
- CloudFront speichert nichts zwischen (Cache-Policy CachingDisabled) und reicht
  Cookies weiter (Origin-Request-Policy AllViewer). Kein WAF.
- Die App selbst ist mit Login geschützt. Das Login-Cookie wird nur über https
  gesendet; ohne CloudFront (direkt über http) ist kein Login möglich.

**Wichtig:** Den Server nicht stoppen. Beim Stoppen und Starten bekommt er eine
neue öffentliche Adresse, und CloudFront zeigt dann ins Leere. Neustarten
(Reboot) ist unproblematisch. Falls er doch gestoppt werden muss: danach in
CloudFront unter Origins die Adresse auf den neuen „Öffentlichen IPv4-DNS" des
Servers ändern. Dauerhafte Abhilfe wäre eine Elastic IP.


## 7. Datensicherung

- RDS erstellt täglich automatische Backups und hält sie 7 Tage.
- Manueller Snapshot `vor-bedrock-umstellung` vom 22.10.2026 (Stand vor dem
  Wechsel auf Bedrock). Kann gelöscht werden, wenn die Suche stabil läuft.
- Wiederherstellen: RDS → Snapshots → Snapshot auswählen → Aktionen →
  Snapshot wiederherstellen. Das legt eine neue Datenbank an; danach in `app.env`
  die Adresse in `DATABASE_URL` anpassen und die App neu starten.


## 8. Neue Videos einlesen (optional)

Im Betrieb ist das nicht vorgesehen, der Datenbestand ist fest (72 Kanäle,
1050 Videos, 3409 Abschnitte). Wenn doch:

1. Einen YouTube-Data-API-Schlüssel in einem Festo-eigenen Google-Cloud-Projekt
   anlegen und als `YOUTUBE_API_KEY=...` in `app.env` eintragen, App neu starten.
2. Auf dem Server einlesen:
   ```bash
   SECRET=$(grep '^INGESTION_SECRET=' ~/app.env | cut -d= -f2-)
   curl -s -X POST -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
     -d '{"videoId":"<YOUTUBE-VIDEO-ID>"}' http://localhost/api/ingest
   ```
   Mehrere Videos: `{"videoIds":["...","..."]}`. Ganzer Kanal:
   `{"channelId":"..."}` an `/api/ingest/channel`.

Videos aus der Suche nehmen geht ohne Schlüssel im Adminbereich unter `/admin`.


## 9. Kosten

Ungefähr pro Monat: EC2 17 $, RDS 17 $, CloudFront und Bedrock bei der jetzigen
Nutzung wenige Dollar. Zusammen etwa 35 bis 40 $. Übersicht in der AWS-Konsole
unter Billing → Cost Explorer.


## 10. Abschalten

Wenn die Anwendung nicht mehr gebraucht wird, in dieser Reihenfolge:

1. CloudFront: Distribution `E24JUQAGTH351M` deaktivieren, nach ein paar Minuten löschen.
2. RDS: `festo-video-search-db` → Ändern → Löschschutz aus → danach Löschen
   (auf Wunsch mit abschließendem Snapshot). Manuelle Snapshots separat löschen.
3. EC2: Instanz `festo-video-search` beenden (Terminate).
4. Sicherheitsgruppen `festo-video-search-app`, `ec2-rds-1`, `rds-ec2-1` löschen.
5. IAM-Rolle `EC2InvokeBedrock` löschen (Admin).
6. Developer-Portal-Team „T2000 Festo Video Search" und App „festo-video-search"
   löschen; FestoGPT wird nicht genutzt.
