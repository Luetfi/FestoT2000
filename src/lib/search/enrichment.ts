import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { HybridSearchResult } from '@/lib/supabase/types';
import { SearchResultSegment, OfficialStatus } from '@/types/search';
import { generateSummaries } from '@/lib/openai/summaries';

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
  const { data: segmentSummaries } = await getSupabaseAdmin()
    .from('segments')
    .select('id, summary')
    .in('id', segmentIds);

  const summaryMap = new Map(
    (segmentSummaries || []).map((s: { id: number; summary: string | null }) => [s.id, s.summary])
  );

  // Find segments missing summaries and generate them
  const missingSummarySegs = segments.filter((seg) => !summaryMap.get(seg.id));
  if (missingSummarySegs.length > 0) {
    const newSummaries = await generateSummaries(missingSummarySegs.map((seg) => seg.text));
    // Cache generated summaries in DB (fire-and-forget)
    for (let i = 0; i < missingSummarySegs.length; i++) {
      const summary = newSummaries[i];
      if (summary) {
        summaryMap.set(missingSummarySegs[i].id, summary);
        getSupabaseAdmin()
          .from('segments')
          // @ts-expect-error - Supabase types not fully inferring
          .update({ summary })
          .eq('id', missingSummarySegs[i].id)
          .then();
      }
    }
  }

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
      channel_name: channel?.name ?? 'Unknown',
      channel_official_status: (channel?.official_status as OfficialStatus) ?? 'unknown',
    };
  });
}
