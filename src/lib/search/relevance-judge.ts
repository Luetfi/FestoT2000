// LLM relevance judge - server-only
// Rates how confidently each search result segment answers the user's question.
// Returns a 0-100 confidence per segment id (a content-based judgement, not just
// vector similarity), used as the "Relevanz"/confidence shown in the UI.
import 'server-only';
import OpenAI from 'openai';
import type { SearchResultSegment } from '@/types/search';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  _openai = new OpenAI({ apiKey });
  return _openai;
}

const JUDGE_MODEL = 'gpt-4o-mini';
// Keep the prompt small: only the leading part of each segment is needed to judge topic relevance.
const MAX_TEXT_CHARS = 700;

const SYSTEM_PROMPT = `Du bewertest, wie sicher ein Video-Abschnitt die Frage eines Nutzers tatsächlich beantwortet bzw. löst.

Jeder Abschnitt enthält den Titel seines Videos ("title") und den Transkript-Ausschnitt ("text").
Der Titel sagt dir, worum es im Video insgesamt geht - berücksichtige ihn unbedingt: Ein kurzer
Transkript-Ausschnitt zeigt oft nur einen Teilaspekt, während der Titel das eigentliche Thema benennt.
Wenn der Titel das Thema der Frage direkt trifft (z. B. Frage "wie lege ich ein Projekt an?" und Titel
"Projekte anlegen"), ist das Video hoch relevant, selbst wenn der gezeigte Ausschnitt nur einen Teil davon behandelt.

Für jeden Abschnitt vergibst du einen Wert von 0 bis 100:
- 90-100: Video und Abschnitt beantworten die Frage direkt und vollständig.
- 70-89: Video/Abschnitt behandeln das Thema klar und sind sehr hilfreich, evtl. nicht jedes Detail.
- 40-69: Thematisch verwandt, beantwortet die Frage aber nur teilweise.
- 0-39: Passt kaum oder gar nicht zur Frage.

Nutze nur Titel und Text der Abschnitte, kein externes Wissen.
Antworte NUR mit JSON in der Form {"scores":[{"id":"<id>","score":<0-100>}]} und bewerte jeden Abschnitt genau einmal.`;

interface JudgeScore {
  id: string;
  score: number;
}

/**
 * Judge how confidently each segment answers the query.
 * Returns a Map of segment id -> confidence (0-100).
 * On any failure returns an empty Map so callers can fall back gracefully.
 */
export async function judgeRelevance(
  query: string,
  segments: SearchResultSegment[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (segments.length === 0 || !query.trim()) {
    return result;
  }

  const items = segments.map((seg) => ({
    id: seg.id,
    title: seg.video_title,
    text: seg.text.slice(0, MAX_TEXT_CHARS),
  }));

  const userContent = `Frage des Nutzers: "${query.trim()}"

Abschnitte:
${JSON.stringify(items)}`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return result;

    const parsed = JSON.parse(raw) as { scores?: JudgeScore[] };
    for (const entry of parsed.scores ?? []) {
      if (entry?.id == null || typeof entry.score !== 'number') continue;
      const clamped = Math.max(0, Math.min(100, Math.round(entry.score)));
      result.set(String(entry.id), clamped);
    }
  } catch (error) {
    console.error('Relevance judge failed:', error);
    return new Map();
  }

  return result;
}
