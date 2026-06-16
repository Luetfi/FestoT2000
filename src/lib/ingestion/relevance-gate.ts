// Ingestion-time relevance gate - server-only
// Decides whether a (community) video is worth ingesting at all: it must be
// about Festo products AND actually solve a concrete technical problem.
// Runs BEFORE embedding so clearly irrelevant videos never cost embedding credits.
// Mirrors the pattern of src/lib/search/relevance-judge.ts (OpenAI, gpt-4o-mini, JSON).
import 'server-only';
import OpenAI from 'openai';

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

const GATE_MODEL = 'gpt-4o-mini';

// Accept threshold: the video must be clearly relevant AND score this high.
export const GATE_SCORE_THRESHOLD = 70;

// How much transcript we send to the gate. We sample the beginning and the
// middle so a video that only gets technical halfway through is still judged
// fairly, while keeping the token cost small.
const HEAD_CHARS = 2200;
const MIDDLE_CHARS = 800;

export interface GateInput {
  title: string;
  description: string | null;
  transcript: string;
}

export interface GateResult {
  relevant: boolean;
  score: number; // 0-100
  contentType: string; // e.g. troubleshooting, commissioning, configuration, programming, other
  reason: string; // short German justification, shown to the reviewer
}

const SYSTEM_PROMPT = `Du bist ein strenger Kurator für eine Festo-Wissensdatenbank. Du entscheidest, ob ein YouTube-Video aufgenommen werden soll.

Ein Video wird NUR aufgenommen, wenn BEIDE Bedingungen erfüllt sind:
1. Es behandelt erkennbar Festo-Produkte oder -Themen (z. B. CMMT, CPX, CPX-E, MPA, VTUG, Ventilinseln, Antriebe, Motorcontroller, Pneumatik/Automatisierung von Festo).
2. Es löst ein konkretes technisches Problem oder zeigt einen konkreten Arbeitsschritt: Inbetriebnahme, Störungs-/Fehlerbehebung, Parametrierung/Konfiguration, Programmierung, Montage/Reparatur oder Diagnose.

Lehne ab (relevant=false): reines Marketing, Imagefilme, Messeauftritte, Unternehmensvorstellungen, reine Produktankündigungen ohne Anleitung, sowie alles, das nicht erkennbar mit Festo zu tun hat.

Vergib einen Score von 0 bis 100:
- 85-100: behandelt Festo UND löst sehr klar ein konkretes Problem mit umsetzbaren Schritten.
- 70-84: Festo-bezogen und klar problemlösend, aber etwas allgemeiner.
- 40-69: thematisch verwandt, aber kaum konkrete Problemlösung.
- 0-39: kein Festo-Bezug oder reines Marketing/Off-Topic.

Bewerte ausschließlich anhand von Titel, Beschreibung und Transkript-Auszug. Nutze kein externes Wissen.

Antworte NUR mit JSON in der Form:
{"relevant": <true|false>, "score": <0-100>, "contentType": "<troubleshooting|commissioning|configuration|programming|assembly|diagnostics|other>", "reason": "<kurze Begründung auf Deutsch>"}`;

function buildTranscriptSample(transcript: string): string {
  const text = transcript.trim();
  if (text.length <= HEAD_CHARS + MIDDLE_CHARS) {
    return text;
  }
  const head = text.slice(0, HEAD_CHARS);
  const midStart = Math.floor(text.length / 2 - MIDDLE_CHARS / 2);
  const middle = text.slice(midStart, midStart + MIDDLE_CHARS);
  return `${head}\n[...]\n${middle}`;
}

/**
 * Judge whether a video should be ingested.
 * On any failure returns relevant=false (in strict mode we reject rather than
 * pollute the index when the gate is unavailable).
 */
export async function gateVideo(input: GateInput): Promise<GateResult> {
  const fallback: GateResult = {
    relevant: false,
    score: 0,
    contentType: 'other',
    reason: 'Relevanz-Gate nicht verfügbar (Fehler) – konservativ abgelehnt.',
  };

  const userContent = `Titel: ${input.title}

Beschreibung:
${(input.description ?? '').slice(0, 800)}

Transkript-Auszug:
${buildTranscriptSample(input.transcript)}`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: GATE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<GateResult>;
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
    const relevant = parsed.relevant === true && score >= GATE_SCORE_THRESHOLD;

    return {
      relevant,
      score,
      contentType: typeof parsed.contentType === 'string' ? parsed.contentType : 'other',
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch (error) {
    console.error('Relevance gate failed:', error);
    return fallback;
  }
}
