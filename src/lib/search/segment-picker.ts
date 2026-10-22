// Bestimmung der Sprungstelle - server-only
//
// Trennt die Frage "wohin im Video?" von der Frage "welches Video?".
//
// Die Videoauswahl trifft weiterhin der titelbewusste Judge
// (relevance-judge.ts). Dessen Anweisung, den Videotitel stark zu gewichten,
// ist fuer die Videoauswahl richtig - fuer die Sprungstelle ist sie schaedlich,
// weil das Anfangssegment den Titel praktisch immer am besten trifft. Genau das
// zeigte die Messung: alle Fehlspruenge lagen zu frueh, fast alle auf Segment 1.
//
// Dieser Picker bewertet daher jedes Segment eines Treffervideos OHNE den Titel
// und allein danach, ob der Ausschnitt selbst die Frage beantwortet.
import 'server-only';
import { complete } from '@/lib/ai/bedrock';
import { query as dbQuery, toVector } from '@/lib/db';
import type { SearchResultSegment } from '@/types/search';

// Anders als beim Video-Judge (relevance-judge.ts, 700 Zeichen) wird hier der
// volle Segmenttext uebergeben. Die Chunks sind rund 800 Zeichen lang; eine
// Kuerzung schnitte das Ende ab, also oft genau die Stelle, an der die
// Erklaerung erst einsetzt.
const MAX_TEXT_CHARS = 1200;

// Obergrenze fuer einen Batch-Aufruf. Bei 5 Videos mit median 4,5 Segmenten
// greift sie nicht; sie schuetzt nur vor einzelnen sehr langen Videos.
const MAX_SEGMENTS_PER_CALL = 80;

// Gewicht der Kosinus-Aehnlichkeit gegenueber dem Modellurteil. Das Urteil
// entscheidet, die Aehnlichkeit bricht Gleichstaende sachlich statt zufaellig.
const SIMILARITY_WEIGHT = 0.15;

// Die Regel zu Begruessung und Verabschiedung ist eine Produktanforderung:
// Niemand will in der Begruessung landen.
const SYSTEM_PROMPT = `Du bestimmst, an welcher Stelle eines Videos ein Nutzer einsteigen muss, um seine Frage beantwortet zu bekommen.

Du erhältst die Frage und die Abschnitte EINES Videos in zeitlicher Reihenfolge. Jeder Abschnitt hat eine "id" und den Text "text". Der Videotitel wird dir bewusst NICHT genannt: Du sollst allein beurteilen, was der Abschnitt selbst zeigt.

Für jeden Abschnitt vergibst du einen Wert von 0 bis 100:
- 90-100: Hier wird die Frage beantwortet bzw. der gesuchte Arbeitsschritt gezeigt.
- 70-89: Der Abschnitt gehört unmittelbar zur Antwort, etwa Vorbereitung oder Fortsetzung des Schritts.
- 40-69: Der Abschnitt behandelt das Thema, beantwortet die Frage aber nicht.
- 0-39: Der Abschnitt trägt zur Frage nichts bei.

Wichtige Regeln:
- Begrüßung, Vorstellung des Videos, Themenankündigung, Agenda, Werbe- und Verabschiedungsfloskeln sind KEINE Antwortstelle. Sie erhalten höchstens 30, auch wenn sie das Thema der Frage wörtlich nennen.
- Eine bloße Ankündigung ("in diesem Video zeigen wir, wie ...") ist keine Antwort. Die Antwort ist die Stelle, an der es tatsächlich gezeigt oder erklärt wird.
- Bewerte jeden Abschnitt einzeln und nur anhand seines eigenen Textes.

Antworte NUR mit JSON in der Form {"scores":[{"id":"<id>","score":<0-100>}]} und bewerte jeden Abschnitt genau einmal.`;

interface VideoSegmentRow {
  id: number;
  video_id: number;
  text: string;
  summary: string | null;
  start_time: number;
  end_time: number;
  similarity: number;
  /** 1-basierte Position im Video; heisst in der RPC segment_position,
   *  weil "position" in Postgres ein Schluesselwort ist. */
  segment_position: number;
}

export interface JumpSegment {
  /** Segment-Id als String, passend zu SearchResultSegment.id. */
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  summary: string | null;
  /** Kosinus-Aehnlichkeit zur Anfrage. */
  similarity: number;
  /** Bewertung des titelfreien Segment-Judges (0-100). */
  segmentScore: number;
}

interface ScoredSegment extends VideoSegmentRow {
  score: number;
}

/**
 * Alle Segmente der uebergebenen Videos laden, mit Aehnlichkeit zur Anfrage.
 */
async function loadSegments(
  videoIds: number[],
  queryEmbedding: number[]
): Promise<VideoSegmentRow[]> {
  try {
    return await dbQuery<VideoSegmentRow>(
      'SELECT * FROM segments_for_videos($1::bigint[], $2::vector)',
      [videoIds, toVector(queryEmbedding)]
    );
  } catch (error) {
    console.error('segments_for_videos failed:', error);
    return [];
  }
}

/**
 * Titelfreie Bewertung aller Segmente in einem Batch-Aufruf.
 * Bei Ausfall eine leere Map, damit der Aufrufer zurueckfallen kann.
 */
async function scoreSegments(
  query: string,
  segments: VideoSegmentRow[]
): Promise<Map<number, number>> {
  const scores = new Map<number, number>();
  if (segments.length === 0) return scores;

  const items = segments.slice(0, MAX_SEGMENTS_PER_CALL).map((seg) => ({
    id: String(seg.id),
    text: seg.text.slice(0, MAX_TEXT_CHARS),
  }));

  const userContent = `Frage des Nutzers: "${query.trim()}"

Abschnitte:
${JSON.stringify(items)}`;

  try {
    const raw = await complete({
      system: SYSTEM_PROMPT,
      user: userContent,
      temperature: 0,
      maxTokens: 4000,
      json: true,
    });
    if (!raw) return scores;

    const parsed = JSON.parse(raw) as { scores?: Array<{ id?: string; score?: number }> };
    for (const entry of parsed.scores ?? []) {
      if (entry?.id == null || typeof entry.score !== 'number') continue;
      const id = Number(entry.id);
      if (!Number.isFinite(id)) continue;
      scores.set(id, Math.max(0, Math.min(100, Math.round(entry.score))));
    }
  } catch (error) {
    console.error('Segment picker judge failed:', error);
    return new Map();
  }

  return scores;
}

/**
 * Rangwert eines Segments: Modellurteil, durch die Aehnlichkeit nur fein
 * nachjustiert. Bei Gleichstand gewinnt das fruehere Segment - vorspulen kann
 * der Nutzer, das Verpasste erraten nicht.
 */
function rank(seg: ScoredSegment): number {
  return seg.score + SIMILARITY_WEIGHT * 100 * seg.similarity - seg.segment_position * 1e-6;
}

/**
 * Je Video das Segment bestimmen, an dem die Anfrage beantwortet wird.
 *
 * Gibt eine leere Map zurueck, wenn die Segmente nicht geladen werden konnten
 * oder das Modell ausfaellt. Der Aufrufer behaelt dann das bisherige Verhalten
 * (bestes Confidence-Segment aus der Trefferliste) - dieselbe Absicherung wie
 * bei judgeRelevance in der Suche.
 */
export async function pickJumpSegments(
  query: string,
  queryEmbedding: number[],
  videoIds: string[]
): Promise<Map<string, JumpSegment>> {
  const result = new Map<string, JumpSegment>();
  const numericIds = videoIds.map(Number).filter((n) => Number.isFinite(n));
  if (numericIds.length === 0 || !query.trim()) return result;

  const segments = await loadSegments(numericIds, queryEmbedding);
  if (segments.length === 0) return result;

  const judged = await scoreSegments(query, segments);
  if (judged.size === 0) return result;

  // Nach Video gruppieren und je Video das beste Segment waehlen.
  const byVideo = new Map<number, ScoredSegment[]>();
  for (const seg of segments) {
    const score = judged.get(seg.id);
    if (score == null) continue;
    const list = byVideo.get(seg.video_id) ?? [];
    list.push({ ...seg, score });
    byVideo.set(seg.video_id, list);
  }

  for (const [videoId, list] of byVideo) {
    const best = list.reduce((a, b) => (rank(b) > rank(a) ? b : a));
    result.set(String(videoId), {
      id: String(best.id),
      start_time: best.start_time,
      end_time: best.end_time,
      text: best.text,
      summary: best.summary ?? null,
      similarity: best.similarity,
      segmentScore: best.score,
    });
  }

  return result;
}

/**
 * Sprungstelle in die Trefferliste eintragen.
 *
 * Die Videoreihenfolge bleibt unangetastet - sie stammt aus dem titelbewussten
 * Judge. Veraendert wird nur, welches Segment
 * eines Videos als Einstieg gilt: Es wird an den Anfang seiner Gruppe gestellt
 * und traegt die Confidence des Videos, damit die Oberflaeche es als bestes
 * Segment der Gruppe waehlt und die angezeigte Relevanz weiterhin die Relevanz
 * des Videos ist.
 *
 * Gehoerte das gewaehlte Segment nicht zur Trefferliste - der Regelfall, denn
 * genau das war die Ursache der zu fruehen Spruenge -, wird es ergaenzt und als
 * `injected` markiert, damit es die Zahl der gefundenen Stellen nicht erhoeht.
 */
export function applyJumpSegments(
  results: SearchResultSegment[],
  jumps: Map<string, JumpSegment>
): SearchResultSegment[] {
  if (jumps.size === 0 || results.length === 0) return results;

  const order: string[] = [];
  const groups = new Map<string, SearchResultSegment[]>();
  for (const seg of results) {
    let group = groups.get(seg.video_id);
    if (!group) {
      group = [];
      groups.set(seg.video_id, group);
      order.push(seg.video_id);
    }
    group.push(seg);
  }

  const out: SearchResultSegment[] = [];
  for (const videoId of order) {
    const group = groups.get(videoId) ?? [];
    const jump = jumps.get(videoId);
    if (!jump) {
      out.push(...group);
      continue;
    }

    const groupConfidence = group.reduce((max, seg) => Math.max(max, seg.confidence ?? 0), 0);
    const existing = group.find((seg) => seg.id === jump.id);

    if (existing) {
      out.push({ ...existing, confidence: groupConfidence });
      out.push(...group.filter((seg) => seg.id !== jump.id));
      continue;
    }

    // Videometadaten vom ersten Segment der Gruppe uebernehmen; nur die
    // Segmentfelder stammen aus dem Picker.
    const template = group[0];
    out.push({
      ...template,
      id: jump.id,
      text: jump.text,
      summary: jump.summary,
      start_time: jump.start_time,
      end_time: jump.end_time,
      similarity: 0,
      semantic_similarity: jump.similarity,
      full_text_match: false,
      confidence: groupConfidence,
      injected: true,
    });
    out.push(...group);
  }

  return out;
}
