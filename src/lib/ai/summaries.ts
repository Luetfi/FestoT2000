// Summary and explanation generation via Amazon Bedrock - server-only
// Generates short KI summaries for transcript segments
import 'server-only';
import { complete } from '@/lib/ai/bedrock';

const CONCURRENCY_LIMIT = 10;

const SYSTEM_PROMPT =
  'Du fasst Transkript-Abschnitte in maximal 10 Wörtern auf Deutsch zusammen. Beschreibe WAS erklärt oder besprochen wird. Antworte IMMER auf Deutsch, auch wenn der Text auf Englisch ist. Antworte nur mit der Zusammenfassung, ohne Anführungszeichen.';

/**
 * Generate a summary for a single text segment
 */
async function generateSummary(text: string): Promise<string> {
  try {
    return await complete({ system: SYSTEM_PROMPT, user: text, temperature: 0.3, maxTokens: 50 });
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return '';
  }
}

/**
 * Generate summaries for multiple texts with concurrency limit
 */
export async function generateSummaries(texts: string[]): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  const results: string[] = new Array(texts.length).fill('');

  // Process in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < texts.length; i += CONCURRENCY_LIMIT) {
    const batch = texts.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(batch.map((text) => generateSummary(text)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}

const EXPLANATION_SYSTEM_PROMPT =
  'Du bist ein technischer Erklärer für Festo-Produkte. Der Nutzer gibt dir ein rohes Transkript aus einem Video-Segment. Erkläre ausführlich und verständlich auf Deutsch, was in diesem Abschnitt besprochen wird. Stütze dich dabei AUSSCHLIESSLICH auf den Inhalt des Transkripts - verwende KEIN externes Wissen. Strukturiere den Text in klare Absätze. Verwende einfache Sprache, aber bleibe fachlich korrekt. Antworte IMMER auf Deutsch, auch wenn das Transkript auf Englisch ist. Antworte nur mit der Erklärung, ohne Einleitung wie "In diesem Abschnitt...".';

/**
 * Generate a detailed explanation for a single text segment (on-demand).
 * When a search query is provided, the explanation answers that specific question
 * based on the segment content instead of summarizing the whole segment.
 */
export async function generateExplanation(text: string, query?: string): Promise<string> {
  const systemPrompt = query
    ? `Du bist ein technischer Experte für Festo-Produkte. Der Nutzer hat folgende Frage: "${query}"

Dir liegt ein Transkript-Abschnitt aus einem Video vor. Deine Antwort MUSS sich AUSSCHLIESSLICH auf die Informationen stützen, die im Transkript-Text enthalten sind. Verwende KEIN externes Wissen oder Allgemeinwissen - nur was tatsächlich im Text steht.

Wenn der Transkript-Abschnitt die Frage nicht direkt beantwortet, erkläre stattdessen, was in diesem Abschnitt tatsächlich besprochen wird, und weise darauf hin, dass dieser Abschnitt die Frage nur teilweise oder indirekt behandelt.

Strukturiere den Text in klare Absätze. Verwende einfache Sprache, aber bleibe fachlich korrekt. Antworte IMMER auf Deutsch. Antworte nur mit der Antwort, ohne Einleitung.`
    : EXPLANATION_SYSTEM_PROMPT;

  const result = await complete({ system: systemPrompt, user: text, temperature: 0.3, maxTokens: 500 });
  if (!result) {
    throw new Error('Empty response from the language model');
  }
  return result;
}
