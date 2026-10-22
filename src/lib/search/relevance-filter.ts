import type { SearchResultSegment } from '@/types/search';
import { PRODUCTION_SEARCH_CONFIG } from '@/lib/search/search-config';

// Die Vorgabewerte stehen zentral in search-config.ts, damit die Suche und
// Vergleichsmessungen dieselben Zahlen benutzen. Die Schwellen bleiben hier als
// Parameter ueberschreibbar, damit sie sich einzeln variieren lassen.
const MIN_SEMANTIC_SIMILARITY = PRODUCTION_SEARCH_CONFIG.minSemanticSimilarity;
const MAX_VIDEO_GROUPS = PRODUCTION_SEARCH_CONFIG.maxVideoGroups;
// Minimum LLM content-relevance confidence (0-100) for a segment to be shown.
// The judge rates 0-39 as "kaum/gar nicht relevant" and 40-69 as partial answers;
// 50 drops irrelevant segments and the weakest partial answers while keeping useful ones.
const MIN_CONFIDENCE = PRODUCTION_SEARCH_CONFIG.minConfidence;

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
  results: SearchResultSegment[],
  minSemanticSimilarity: number = MIN_SEMANTIC_SIMILARITY
): SearchResultSegment[] {
  if (results.length === 0) return [];

  return results.filter(
    (r) => r.full_text_match || r.semantic_similarity >= minSemanticSimilarity
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
 *
 * Die Liste ist nach Confidence sortiert, die Segmente eines Videos stehen darin
 * also verstreut. Ein Abbruch beim ersten Segment des (max+1)-ten Videos wuerde
 * deshalb auch noch nicht gesehene Segmente der zugelassenen Videos verwerfen -
 * und damit ausgerechnet die weiteren Fundstellen im besten Treffer. Daher wird
 * uebersprungen statt abgebrochen.
 */
export function capVideoGroups(
  results: SearchResultSegment[],
  max: number = MAX_VIDEO_GROUPS
): SearchResultSegment[] {
  const acceptedVideos = new Set<string>();
  const capped: SearchResultSegment[] = [];

  for (const result of results) {
    if (!acceptedVideos.has(result.video_id)) {
      if (acceptedVideos.size >= max) continue;
      acceptedVideos.add(result.video_id);
    }
    capped.push(result);
  }

  return capped;
}
