import type { SearchResultSegment } from '@/types/search';

const MIN_SEMANTIC_SIMILARITY = 0.3;
const RELATIVE_SCORE_THRESHOLD = 0.6;
const MAX_VIDEO_GROUPS = 5;
/**
 * Filter search results by relevance using 3-stage filtering:
 * 1. Absolute semantic filter - remove semantically irrelevant results
 * 2. Relative score filter - keep only results within 60% of the top score
 * 3. Video group cap - limit to 5 distinct videos
 */
export function filterByRelevance(
  results: SearchResultSegment[]
): SearchResultSegment[] {
  if (results.length === 0) return [];

  // Stage 1: Absolute semantic filter
  let filtered = results.filter(
    (r) => r.semantic_similarity >= MIN_SEMANTIC_SIMILARITY
  );

  if (filtered.length === 0) {
    return [];
  }

  // Stage 2: Relative score filter (based on boosted similarity)
  const topScore = filtered[0].similarity;
  const minScore = topScore * RELATIVE_SCORE_THRESHOLD;
  filtered = filtered.filter((r) => r.similarity >= minScore);

  // Stage 3: Video group cap
  const seenVideos = new Set<string>();
  const capped: SearchResultSegment[] = [];

  for (const result of filtered) {
    seenVideos.add(result.video_id);
    if (seenVideos.size > MAX_VIDEO_GROUPS) break;
    capped.push(result);
  }

  return capped;
}
