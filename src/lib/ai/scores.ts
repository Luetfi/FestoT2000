// Robust reading of {"scores":[{"id":"…","score":…}]} model answers.
//
// The judge prompts ask for exactly that JSON. On long lists (60 segments)
// Amazon Nova occasionally emits a malformed object - a missing comma or a
// stray token - and a strict JSON.parse then throws away every score. The
// regex fallback recovers each well-formed {"id": …, "score": …} pair on its own.

export interface ScoreEntry {
  id: string;
  score: number;
}

const PAIR_PATTERN =
  /"id"\s*:\s*"?([^",}\s]+)"?\s*,\s*"score"\s*:\s*(-?\d+(?:\.\d+)?)|"score"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"id"\s*:\s*"?([^",}\s]+)"?/g;

export function parseScores(raw: string): { scores: ScoreEntry[]; recovered: boolean } {
  try {
    const parsed = JSON.parse(raw) as { scores?: Array<{ id?: unknown; score?: unknown }> };
    const scores: ScoreEntry[] = [];
    for (const entry of parsed.scores ?? []) {
      if (entry?.id == null || typeof entry.score !== 'number') continue;
      scores.push({ id: String(entry.id), score: entry.score });
    }
    return { scores, recovered: false };
  } catch {
    const scores: ScoreEntry[] = [];
    for (const match of raw.matchAll(PAIR_PATTERN)) {
      const id = match[1] ?? match[4];
      const score = Number(match[2] ?? match[3]);
      if (id && Number.isFinite(score)) scores.push({ id, score });
    }
    return { scores, recovered: true };
  }
}
