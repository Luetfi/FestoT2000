import 'server-only';
import { query } from '@/lib/db';
import { HybridSearchResult } from '@/lib/db/types';
import { SearchResultSegment, OfficialStatus } from '@/types/search';
import { generateSummaries } from '@/lib/ai/summaries';

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

  // Extract unique video IDs and segment IDs
  const videoIds = [...new Set(segments.map((seg) => seg.video_id))];
  const segmentIds = segments.map((seg) => seg.id);

  // Fetch summaries for matched segments
  const segmentSummaries = await query<{ id: number; summary: string | null }>(
    'SELECT id, summary FROM segments WHERE id = ANY($1::bigint[])',
    [segmentIds]
  );

  const summaryMap = new Map(segmentSummaries.map((s) => [s.id, s.summary]));

  // Find segments missing summaries and generate them
  const missingSummarySegs = segments.filter((seg) => !summaryMap.get(seg.id));
  if (missingSummarySegs.length > 0) {
    const newSummaries = await generateSummaries(missingSummarySegs.map((seg) => seg.text));
    // Cache generated summaries in DB (fire-and-forget)
    for (let i = 0; i < missingSummarySegs.length; i++) {
      const summary = newSummaries[i];
      if (summary) {
        summaryMap.set(missingSummarySegs[i].id, summary);
        query('UPDATE segments SET summary = $2 WHERE id = $1', [missingSummarySegs[i].id, summary])
          .catch((err) => console.error('Caching segment summary failed:', err));
      }
    }
  }

  // Fetch videos with channel data in single query
  const videos = await query<{
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    has_transcript: boolean | null;
    channel_name: string | null;
    channel_official_status: string | null;
  }>(
    `SELECT v.id, v.youtube_id, v.title, v.description, v.thumbnail_url,
            v.duration_seconds, v.has_transcript,
            c.name AS channel_name, c.official_status AS channel_official_status
     FROM videos v
     LEFT JOIN channels c ON c.id = v.channel_id
     WHERE v.id = ANY($1::bigint[])`,
    [videoIds]
  );

  // Build lookup map for O(1) access
  const videoMap = new Map(videos.map((video) => [video.id, video]));

  // Map segments to enriched format
  return segments.map((seg) => {
    const video = videoMap.get(seg.video_id);

    return {
      id: String(seg.id),
      text: seg.text,
      summary: summaryMap.get(seg.id) ?? null,
      start_time: seg.start_time,
      end_time: seg.end_time,
      similarity: seg.rrf_score,
      semantic_similarity: seg.semantic_similarity,
      full_text_match: seg.full_text_match ?? false,
      video_id: String(seg.video_id),
      video_youtube_id: video?.youtube_id ?? '',
      video_title: video?.title ?? '',
      video_description: video?.description ?? null,
      video_thumbnail_url: video?.thumbnail_url ?? '',
      video_duration_seconds: video?.duration_seconds ?? null,
      video_has_transcript: video?.has_transcript ?? false,
      channel_name: video?.channel_name ?? 'Unknown',
      channel_official_status: (video?.channel_official_status as OfficialStatus) ?? 'unknown',
    };
  });
}
