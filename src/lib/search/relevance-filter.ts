import type { SearchResultSegment } from '@/types/search';

const MIN_SEMANTIC_SIMILARITY = 0.3;
const MAX_VIDEO_GROUPS = 5;
// Minimum LLM content-relevance confidence (0-100) for a segment to be shown.
// The judge rates 0-39 as "kaum/gar nicht relevant" and 40-69 as partial answers;
// 50 drops irrelevant segments and the weakest partial answers while keeping useful ones.
const MIN_CONFIDENCE = 50;

/**
 * Cheap absolute pre-filter (runs before the LLM judge): drop segments whose
 * semantic similarity is so low they cannot plausibly be relevant. This only
 * removes obvious garbage; deciding actual relevance is the (title-aware) LLM
 * judge's job (see judgeRelevance + filterByConfidence).
 *
 * We deliberately do NOT apply a *relative* score cut here. The hybrid score
 * (RRF) blends full-text rank noise, so a relative cut could discard a video's
 * strongest segment while keeping a weaker one from the same video - which once
 * hid the exact-match video "MyFesto: Projekte anlegen" from the results. Every
 * segment above the absolute floor now reaches the judge, which scores each one
 * on its content *and* its video title, so a topical exact match can no longer
 * be filtered out before it is ever evaluated.
 *
 * Full-text matches (segment text or video title) are always kept: a title-only
 * match has semantic_similarity 0 and would wrongly fail the absolute floor,
 * which is exactly what hid videos when their title was searched verbatim. The
 * (title-aware) judge + confidence floor still gate genuinely irrelevant ones.
 *
 * The video-group cap is applied separately (see capVideoGroups) AFTER the
 * content-relevance filter so an irrelevant high-scoring video cannot crowd a
 * relevant one out of the top groups.
 */
export function filterByRelevance(
  results: SearchResultSegment[]
): SearchResultSegment[] {
  if (results.length === 0) return [];

  return results.filter(
    (r) => r.full_text_match || r.semantic_similarity >= MIN_SEMANTIC_SIMILARITY
  );
}

/**
 * Content-relevance filter using the LLM judge confidence (0-100).
 * Drops segments the judge does not consider relevant enough to solve the query.
 *
 * Graceful degradation: when the judge is unavailable (judgeAvailable === false)
 * the confidence values are only the cosine-similarity fallback, so we skip
 * filtering entirely to avoid wrongly emptying the result list.
 */
export function filterByConfidence(
  results: SearchResultSegment[],
  judgeAvailable: boolean,
  minConfidence: number = MIN_CONFIDENCE
): SearchResultSegment[] {
  if (!judgeAvailable) return results;
  return results.filter((r) => (r.confidence ?? 0) >= minConfidence);
}

/**
 * Limit results to segments from at most `max` distinct videos, preserving order.
 */
export function capVideoGroups(
  results: SearchResultSegment[],
  max: number = MAX_VIDEO_GROUPS
): SearchResultSegment[] {
  const seenVideos = new Set<string>();
  const capped: SearchResultSegment[] = [];

  for (const result of results) {
    seenVideos.add(result.video_id);
    if (seenVideos.size > max) break;
    capped.push(result);
  }

  return capped;
}
