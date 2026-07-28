// Channel synchronization logic - RSS-first with API fallback
import 'server-only';

import { fetchChannelRss } from '@/lib/youtube/rss';
import { fetchChannelVideoIds } from '@/lib/youtube/api';
import { ingestVideo } from '@/lib/ingestion/pipeline';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export interface SyncResult {
  channelId: string;
  source: 'rss' | 'api';
  candidateCount: number;
  newVideoIds: string[];
  ingested: number;
  /** Pending videos left over because of the per-run cap; next run picks them up. */
  deferred: number;
  errors: string[];
}

/**
 * Sync a single YouTube channel: discover new videos and ingest them.
 *
 * 1. Fetch recent video IDs via RSS (0 quota) with API fallback (~2 quota)
 * 2. Filter out videos that are already fully processed
 * 3. Ingest the rest, capped at maxVideos per run
 *
 * @param maxVideos - Cap on videos ingested per run. Protects against the
 *   function timeout; leftovers are picked up by the next run.
 */
export async function syncChannel(channelId: string, maxVideos = 4): Promise<SyncResult> {
  let candidateIds: string[];
  let source: 'rss' | 'api';

  // Step 1: Get recent video IDs (RSS first, API fallback)
  try {
    const entries = await fetchChannelRss(channelId);
    candidateIds = entries.map((e) => e.videoId);
    source = 'rss';
  } catch (rssError) {
    console.warn(
      `RSS fetch failed for ${channelId}, falling back to API:`,
      rssError instanceof Error ? rssError.message : rssError
    );
    candidateIds = await fetchChannelVideoIds(channelId, 20);
    source = 'api';
  }

  if (candidateIds.length === 0) {
    return { channelId, source, candidateCount: 0, newVideoIds: [], ingested: 0, deferred: 0, errors: [] };
  }

  // Step 2: Filter out videos that are already DONE. A row existing is not
  // enough — ingestVideo() upserts the video row before fetching the transcript,
  // so a run that dies mid-pipeline (timeout, OpenAI error) leaves a row behind
  // with has_transcript = false. Skipping on mere existence would strand those
  // videos permanently. Done means either:
  //   - has_transcript = true  -> fully ingested and searchable
  //   - review_status = 'rejected' -> deliberately excluded (no DE/EN transcript,
  //     empty transcript, or rejected by the relevance gate)
  // Everything else is retried on the next run.
  const { data: existingRows } = await getSupabaseAdmin()
    .from('videos')
    .select('youtube_id, has_transcript, review_status')
    .in('youtube_id', candidateIds);

  const doneIds = new Set(
    (existingRows ?? [])
      .map((r) => r as { youtube_id: string; has_transcript: boolean | null; review_status: string | null })
      .filter((r) => r.has_transcript === true || r.review_status === 'rejected')
      .map((r) => r.youtube_id)
  );

  const pendingVideoIds = candidateIds.filter((id) => !doneIds.has(id));

  if (pendingVideoIds.length === 0) {
    return { channelId, source, candidateCount: candidateIds.length, newVideoIds: [], ingested: 0, deferred: 0, errors: [] };
  }

  // Step 3: Ingest, newest first, capped so the run fits in the function budget
  const newVideoIds = pendingVideoIds.slice(0, maxVideos);
  const deferred = pendingVideoIds.length - newVideoIds.length;

  if (deferred > 0) {
    console.log(
      `[channel-sync] ${channelId}: ${deferred} video(s) deferred to the next run (cap ${maxVideos})`
    );
  }

  const errors: string[] = [];
  let ingested = 0;

  for (const videoId of newVideoIds) {
    console.log(`[channel-sync] Ingesting new video ${videoId} from channel ${channelId}`);
    const result = await ingestVideo(videoId);

    if (result.status === 'error') {
      errors.push(`${videoId}: ${result.error}`);
    } else {
      ingested++;
    }
  }

  return { channelId, source, candidateCount: candidateIds.length, newVideoIds, ingested, deferred, errors };
}
