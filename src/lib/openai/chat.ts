// OpenAI chat streaming - server-only
// Builds RAG system prompts and creates streaming completions
import 'server-only';
import OpenAI from 'openai';
import type { SearchResultSegment } from '@/types/search';
import { formatDuration } from '@/types/search';
import type { ChatMessage } from '@/types/chat';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  _openai = new OpenAI({
    apiKey,
  });

  return _openai;
}

const CHAT_MODEL = 'gpt-4o-mini';

/**
 * Build system prompt with video segment context for RAG
 */
export function buildSystemPrompt(segments: SearchResultSegment[]): string {
  const contextBlocks = segments.map((seg, i) => {
    const timestamp = formatDuration(seg.start_time);
    return `[Quelle ${i + 1}] Video: "${seg.video_title}" | Zeitstempel: ${timestamp} | Link: [📹 ${seg.video_title} | ${timestamp}](/video/${seg.video_id}?segment=${seg.id})
Inhalt: ${seg.text}`;
  });

  return `Du bist der Festo DIY-Finder Assistent. Du hilfst Nutzern, passende Video-Anleitungen zu technischen Fragen rund um Festo-Produkte zu finden.

WICHTIG ZU DEINER FUNKTIONSWEISE:
- Dir werden pro Anfrage nur die relevantesten Quellen aus einer grossen Video-Datenbank angezeigt, NICHT die gesamte Datenbank.
- Behaupte NIEMALS, dass die angezeigten Quellen die einzigen verfügbaren Videos sind.
- Wenn Nutzer nach einer Übersicht aller verfügbaren Videos fragen, verweise sie auf die Suchfunktion der Website, da du immer nur einen Ausschnitt siehst.

REGELN:
- Antworte IMMER auf Deutsch.
- Stütze dich AUSSCHLIESSLICH auf die bereitgestellten Quellen. Verwende KEIN externes Wissen.
- Wenn du auf ein Video verweist, verwende IMMER das exakte Link-Format aus den Quellen: [📹 Titel | Zeitstempel](/video/ID?segment=SID)
- Wenn keine der Quellen die Frage beantworten kann, sage ehrlich, dass du dazu keine passende Quelle gefunden hast, aber empfehle dem Nutzer, die Suchfunktion der Website zu nutzen, da dort weitere Videos verfügbar sein könnten.
- Halte deine Antworten prägnant und hilfreich.
- Strukturiere längere Antworten mit Absätzen.

VERFÜGBARE QUELLEN:
${contextBlocks.length > 0 ? contextBlocks.join('\n\n') : 'Keine relevanten Quellen gefunden.'}`;
}

/**
 * Create a streaming chat completion
 */
export async function createChatStream(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
) {
  const openai = getOpenAI();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  return openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    max_tokens: 1000,
    stream: true,
    messages,
  });
}
