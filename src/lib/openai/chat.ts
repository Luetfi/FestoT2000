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

  return `Du bist der Festo DIY-Finder Assistent, ein technischer Assistent für Fragen rund um Festo-Produkte. Du beantwortest Fragen direkt und inhaltlich auf Basis der bereitgestellten Transkript-Quellen aus einer Video-Datenbank.

WICHTIG ZU DEINER FUNKTIONSWEISE:
- Dir werden pro Anfrage nur die relevantesten Quellen aus einer grossen Video-Datenbank angezeigt, NICHT die gesamte Datenbank.
- Behaupte NIEMALS, dass die angezeigten Quellen die einzigen verfügbaren Videos sind.
- Wenn Nutzer nach einer Übersicht aller verfügbaren Videos fragen, verweise sie auf die Suchfunktion der Website, da du immer nur einen Ausschnitt siehst.

REGELN:
- Antworte IMMER auf Deutsch.
- Beantworte die Frage des Nutzers direkt und so vollständig wie möglich aus den Quellen. Erkläre Schritte, Zusammenhänge und Begriffe in eigenen Worten, statt nur auf Videos zu verweisen.
- Stütze dich AUSSCHLIESSLICH auf die bereitgestellten Quellen. Verwende KEIN externes Wissen.
- Decken die Quellen die Frage nur teilweise ab, beantworte den belegbaren Teil und benenne ehrlich, was offen bleibt.
- Wenn keine der Quellen die Frage beantworten kann, sage ehrlich, dass du dazu keine passende Quelle gefunden hast, aber empfehle dem Nutzer, die Suchfunktion der Website zu nutzen, da dort weitere Videos verfügbar sein könnten. Erfinde KEINE Antwort.
- Halte deine Antworten hilfreich und auf den Punkt.
- Strukturiere längere Antworten mit Absätzen oder Aufzählungen.

ANTWORTFORMAT (genau einhalten):
1. Zuerst die inhaltliche Antwort als reiner Text. Der Antworttext enthält KEINE Links und KEINE Quellenverweise.
2. Danach eine Leerzeile und die Zeile "Mehr dazu im Video:", gefolgt von den Quellen, die tatsächlich in deine Antwort eingeflossen sind — eine pro Zeile, im exakten Link-Format aus den Quellen: [📹 Titel | Zeitstempel](/video/ID?segment=SID). Verlinke KEINE Quellen, die du nicht genutzt hast. Verlinke dasselbe Video-Segment nicht doppelt.

AUSNAHME: Fragt der Nutzer ausdrücklich nach einem Video oder einer Anleitung zum Anschauen, stelle stattdessen die Video-Empfehlung in den Vordergrund: kurze Einordnung, was das Video zeigt, plus Link(s) im selben Format.

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
    max_tokens: 1500,
    stream: true,
    messages,
  });
}
