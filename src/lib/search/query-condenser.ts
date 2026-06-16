// Query condenser - server-only
// Rewrites follow-up chat messages into standalone search queries so that
// retrieval works even when the message only makes sense in conversation
// context (e.g. "und wie geht das beim CMMT-ST?"). First messages skip the
// LLM call entirely; any failure falls back to the original message.
import 'server-only';
import OpenAI from 'openai';
import type { ChatMessage } from '@/types/chat';

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

const CONDENSE_MODEL = 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 6;
const MAX_QUERY_CHARS = 200;

const SYSTEM_PROMPT = `Du formulierst die letzte Nachricht eines Nutzers in einem Chat über Festo-Produkte zu einer eigenständigen deutschen Suchanfrage um.
Die Suchanfrage wird gegen eine Datenbank mit Video-Transkripten ausgeführt.
Löse Pronomen und Bezüge auf den Gesprächsverlauf auf (z.B. "und beim CMMT-ST?" nach einer Frage zur CMMT-AS Inbetriebnahme wird zu "CMMT-ST Inbetriebnahme").
Erfinde nichts, was weder in der Nachricht noch im Verlauf steht.
Ist die Nachricht bereits eigenständig verständlich, gib sie unverändert zurück.
Halte die Suchanfrage kurz und direkt suchbar.
Antworte NUR mit JSON in der Form {"query":"..."}.`;

/**
 * Condense a chat message into a standalone search query using the
 * conversation history. Returns the original message when there is no
 * history or on any failure, so callers degrade gracefully.
 */
export async function condenseQuery(message: string, history: ChatMessage[]): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed || history.length === 0) return trimmed;

  const historyBlock = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => `${msg.role === 'user' ? 'Nutzer' : 'Assistent'}: ${msg.content}`)
    .join('\n');

  const userContent = `Gesprächsverlauf:\n${historyBlock}\n\nLetzte Nachricht des Nutzers: "${trimmed}"`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: CONDENSE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return trimmed;

    const parsed = JSON.parse(raw) as { query?: unknown };
    if (typeof parsed.query !== 'string') return trimmed;

    const query = parsed.query.trim();
    if (!query || query.length > MAX_QUERY_CHARS) return trimmed;

    return query;
  } catch (error) {
    console.error('Query condenser failed:', error);
    return trimmed;
  }
}
