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
  errors: string[];
}

/**
 * Sync a single YouTube channel: discover new videos and ingest them.
 *
 * 1. Fetch recent video IDs via RSS (0 quota) with API fallback (~2 quota)
 * 2. Filter out videos already in the database
 * 3. Ingest only the new ones
 */
export async function syncChannel(channelId: string): Promise<SyncResult> {
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
    return { channelId, source, candidateCount: 0, newVideoIds: [], ingested: 0, errors: [] };
  }

  // Step 2: Find which videos are already in the database
  const { data: existingRows } = await getSupabaseAdmin()
    .from('videos')
    .select('youtube_id')
    .in('youtube_id', candidateIds);

  const existingIds = new Set((existingRows ?? []).map((r) => (r as { youtube_id: string }).youtube_id));
  const newVideoIds = candidateIds.filter((id) => !existingIds.has(id));

  if (newVideoIds.length === 0) {
    return { channelId, source, candidateCount: candidateIds.length, newVideoIds: [], ingested: 0, errors: [] };
  }

  // Step 3: Ingest new videos
  let ingested = 0;
  const errors: string[] = [];

  for (const videoId of newVideoIds) {
    console.log(`[channel-sync] Ingesting new video ${videoId} from channel ${channelId}`);
    const result = await ingestVideo(videoId);

    if (result.status === 'error') {
      errors.push(`${videoId}: ${result.error}`);
    } else {
      ingested++;
    }
  }

  return { channelId, source, candidateCount: candidateIds.length, newVideoIds, ingested, errors };
}
