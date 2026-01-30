import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { HybridSearchResult } from '@/lib/supabase/types';
import { SearchResultSegment, OfficialStatus } from '@/types/search';
import { ParsedQuery } from './types';

/**
 * Enrich raw hybrid search results with video and channel metadata
 *
 * Fetches video and channel data in a single query for all segments,
 * then maps to the denormalized SearchResultSegment format for UI rendering.
 */
export async function enrichSearchResults(
  segments: HybridSearchResult[]
): Promise<SearchResultSegment[]> {
  if (segments.length === 0) {
    return [];
  }

  // Extract unique video IDs
  const videoIds = [...new Set(segments.map((seg) => seg.video_id))];

  // Fetch videos with channels data in single query
  const { data: videos } = await getSupabaseAdmin()
    .from('videos')
    .select(`
      id,
      youtube_id,
      title,
      description,
      thumbnail_url,
      duration_seconds,
      has_transcript,
      channels (
        name,
        official_status
      )
    `)
    .in('id', videoIds);

  // Build lookup map for O(1) access
  const videoMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (videos || []).map((video: any) => [video.id, video])
  );

  // Map segments to enriched format
  return segments.map((seg) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const video: any = videoMap.get(seg.video_id);
    // Supabase returns channels as array for join, but could be single object
    const channel = video?.channels?.[0] || video?.channels;

    return {
      id: String(seg.id),
      text: seg.text,
      start_time: seg.start_time,
      end_time: seg.end_time,
      similarity: seg.rrf_score,
      video_id: String(seg.video_id),
      video_youtube_id: video?.youtube_id ?? '',
      video_title: video?.title ?? '',
      video_description: video?.description ?? null,
      video_thumbnail_url: video?.thumbnail_url ?? '',
      video_duration_seconds: video?.duration_seconds ?? null,
      video_has_transcript: video?.has_transcript ?? false,
      channel_name: channel?.name ?? 'Unknown',
      channel_official_status: (channel?.official_status as OfficialStatus) ?? 'unknown',
    };
  });
}

/**
 * Apply relevance boosts for error codes and product keywords
 *
 * Increases similarity scores for segments containing:
 * - Error codes (1.5x boost) - highest priority for troubleshooting
 * - Product keywords (1.25x boost) - medium priority for product-specific content
 *
 * Re-sorts results by boosted similarity score.
 */
export function applyBoosts(
  results: SearchResultSegment[],
  parsed: ParsedQuery
): SearchResultSegment[] {
  const boosted = results.map((result) => {
    let boostFactor = 1.0;
    const textLower = result.text.toLowerCase();

    // Check for error code matches (highest priority)
    for (const errorCode of parsed.errorCodes) {
      if (textLower.includes(errorCode.toLowerCase())) {
        boostFactor = Math.max(boostFactor, 1.5);
        break;
      }
    }

    // Check for product keyword matches (medium priority)
    if (boostFactor === 1.0) {
      for (const keyword of parsed.productKeywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          boostFactor = Math.max(boostFactor, 1.25);
          break;
        }
      }
    }

    // Apply boost if match found
    if (boostFactor > 1.0) {
      return {
        ...result,
        similarity: result.similarity * boostFactor,
      };
    }

    return result;
  });

  // Re-sort by boosted similarity descending
  return boosted.sort((a, b) => b.similarity - a.similarity);
}
