// Zweisprachige Anfrage - server-only
//
// Die Anfragen sind deutsch, rund drei Viertel der Transkripte englisch.
// Eine deutsche Anfrage und ein englisches Transkript teilen bei
// Fachbegriffen oft keine einzige Oberflaechenform - "Inbetriebnahme" gegen
// "commissioning", "Verschleissteil" gegen "wear part". Das ist keine Frage der
// Volltextkonfiguration, sondern eine Vokabelluecke: der lexikalische Zweig
// kann dort grundsaetzlich nicht treffen, und der semantische muss die Bruecke
// allein schlagen.
//
// Messbefund: lexikalischer Recall@5 auf englischen Transkripten
// 7,1 % gegenueber 33,3 % auf deutschen; Gesamtsystem 71,4 % gegenueber 100 %.
// Alle acht nicht gefundenen Anfragen betreffen englische Transkripte.
//
// Deshalb wird die Anfrage zusaetzlich uebersetzt und mitgesucht. Die
// Datenbankfunktion wertet je Segment den besseren Rang beider Fassungen, das
// Ergebnis wird also breiter, ohne dass der semantische Zweig lauter wird
// (siehe hybrid_search_segments in db/schema.sql).
import 'server-only';
import { complete } from '@/lib/ai/bedrock';

// Anfragen wiederholen sich im Betrieb; der Cache spart den Aufruf. Bewusst
// klein und prozesslokal - eine dauerhafte Ablage waere fuer eine Uebersetzung
// unverhaeltnismaessig.
const CACHE_LIMIT = 200;
const cache = new Map<string, string | null>();

const SYSTEM_PROMPT = `Du uebersetzt Suchanfragen aus dem Deutschen ins Englische fuer eine technische Videosuche (Industrieautomatisierung, Festo-Produkte).

Regeln:
- Gib ausschliesslich die uebersetzte Suchanfrage zurueck, ohne Anfuehrungszeichen und ohne Erklaerung.
- Produktbezeichnungen, Typenschluessel und Normen bleiben unveraendert (z. B. CMMT-AS, CPX-AP-I-EC, PROFINET, EtherCAT, IO-Link).
- Uebersetze Fachbegriffe so, wie sie in englischsprachiger technischer Dokumentation vorkommen (Inbetriebnahme -> commissioning, Verschleissteil -> wear part, Anschluss -> connection).
- Ist die Anfrage bereits englisch, gib sie unveraendert zurueck.
- Keine Synonymliste, keine Erweiterung, keine zusaetzlichen Begriffe.`;

/**
 * Englische Fassung der Anfrage.
 *
 * Gibt null zurueck, wenn keine sinnvolle Uebersetzung vorliegt oder der Aufruf
 * fehlschlaegt - die Suche laeuft dann einsprachig weiter. Ist die Anfrage
 * bereits englisch, kann die Uebersetzung mit der Anfrage uebereinstimmen; das
 * ist unschaedlich, weil die Datenbankfunktion je Segment nur den besseren Rang
 * beider Fassungen wertet.
 */
export async function translateQuery(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;

  let translated: string | null = null;
  try {
    const raw = await complete({ system: SYSTEM_PROMPT, user: trimmed, temperature: 0, maxTokens: 100 });
    // Eine Uebersetzung, die deutlich laenger ist als die Anfrage, ist keine
    // Uebersetzung mehr, sondern eine Erlaeuterung - dann lieber einsprachig.
    if (raw && raw.length > 0 && raw.length <= trimmed.length * 3) {
      translated = raw;
    }
  } catch (error) {
    console.error('Query translation failed:', error);
    translated = null;
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(trimmed, translated);
  return translated;
}
