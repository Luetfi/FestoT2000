// Chat title generation - server-only
// Generates a short German title for a conversation from its first exchange.
// Returns null on any failure so callers fall back to a truncated question.
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

const TITLE_MODEL = 'gpt-4o-mini';
const MAX_TITLE_CHARS = 60;
const MAX_ANSWER_CHARS = 500;

const SYSTEM_PROMPT = `Du erstellst einen kurzen deutschen Titel für eine Chat-Unterhaltung über Festo-Produkte.
Der Titel fasst das Thema der ersten Frage prägnant zusammen, maximal 6 Wörter,
ohne Anführungszeichen, ohne Satzzeichen am Ende, keine Floskeln wie "Frage zu".
Antworte NUR mit JSON in der Form {"title":"..."}.`;

/**
 * Generate a concise conversation title from the first question/answer pair.
 */
export async function generateChatTitle(question: string, answer: string): Promise<string | null> {
  if (!question.trim()) return null;

  const userContent = [
    `Erste Frage des Nutzers: "${question.trim()}"`,
    answer.trim() ? `Anfang der Antwort: "${answer.trim().slice(0, MAX_ANSWER_CHARS)}"` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: TITLE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { title?: unknown };
    if (typeof parsed.title !== 'string') return null;

    const title = parsed.title.trim().replace(/^["']|["']$/g, '');
    if (!title) return null;

    return title.slice(0, MAX_TITLE_CHARS);
  } catch (error) {
    console.error('Chat title generation failed:', error);
    return null;
  }
}
