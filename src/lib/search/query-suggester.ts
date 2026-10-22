// Query suggester - server-only
// When a search yields weak/no results, propose 2-3 more precise Festo search
// terms the user could try instead. The judged "weakness" of the query is used
// upstream as the trigger; this module only generates the actionable suggestions.
import 'server-only';
import { complete } from '@/lib/ai/bedrock';
import type { QuerySuggestion } from '@/types/search';

const MAX_SUGGESTIONS = 3;
const MAX_TERM_CHARS = 60;

const SYSTEM_PROMPT: Record<'de' | 'en', string> = {
  de: `Du hilfst Nutzern, eine Festo-Video-Datenbank besser zu durchsuchen.
Die letzte Suche lieferte kaum oder keine guten Treffer. Schlage 2-3 präzisere
Suchbegriffe oder Umformulierungen vor, die wahrscheinlich bessere Treffer liefern
(z.B. konkrete Festo-Produkttypen wie CMMT-AS oder DSBC, Fehlercodes, oder eine
klar formulierte Aufgabe wie "CMMT-AS Inbetriebnahme").
Wiederhole keine bereits erkannten Begriffe. Halte jeden "term" kurz und
direkt suchbar. "reason" ist eine sehr kurze Begründung (max. 6 Wörter).
Antworte NUR mit JSON in der Form {"suggestions":[{"term":"...","reason":"..."}]}.`,
  en: `You help users search a Festo video database more effectively.
The last search returned few or no good matches. Suggest 2-3 more precise
search terms or reformulations likely to return better results (e.g. concrete
Festo product types like CMMT-AS or DSBC, error codes, or a clearly phrased task
like "CMMT-AS commissioning").
Do not repeat terms that were already detected. Keep each "term" short and
directly searchable. "reason" is a very short rationale (max 6 words).
Respond ONLY with JSON of the form {"suggestions":[{"term":"...","reason":"..."}]}.`,
};

interface RawSuggestion {
  term?: unknown;
  reason?: unknown;
}

/**
 * Suggest more precise search terms for a weak query.
 * Returns at most MAX_SUGGESTIONS suggestions, or an empty array on any failure
 * (including missing model access) so callers degrade gracefully.
 */
export async function suggestQuery(
  query: string,
  lang: 'de' | 'en',
  topTitles: string[]
): Promise<QuerySuggestion[]> {
  if (!query.trim()) return [];

  const userContent = [
    lang === 'de' ? `Suchanfrage des Nutzers: "${query.trim()}"` : `User search query: "${query.trim()}"`,
    topTitles.length > 0
      ? (lang === 'de'
          ? `Schwache Treffer bisher: ${topTitles.join(' | ')}`
          : `Weak matches so far: ${topTitles.join(' | ')}`)
      : (lang === 'de' ? 'Bisher keine Treffer.' : 'No matches so far.'),
  ].join('\n');

  try {
    const raw = await complete({
      system: SYSTEM_PROMPT[lang],
      user: userContent,
      temperature: 0,
      json: true,
    });
    if (!raw) return [];

    const parsedJson = JSON.parse(raw) as { suggestions?: RawSuggestion[] };
    const out: QuerySuggestion[] = [];
    const seen = new Set<string>();

    for (const entry of parsedJson.suggestions ?? []) {
      if (typeof entry?.term !== 'string') continue;
      const term = entry.term.trim();
      if (!term || term.length > MAX_TERM_CHARS) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const reason = typeof entry.reason === 'string' ? entry.reason.trim() : undefined;
      out.push(reason ? { term, reason } : { term });
      if (out.length >= MAX_SUGGESTIONS) break;
    }

    return out;
  } catch (error) {
    console.error('Query suggester failed:', error);
    return [];
  }
}
