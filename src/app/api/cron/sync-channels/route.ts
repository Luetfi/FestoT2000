// Cron job endpoint for channel synchronization
// Polls monitored YouTube channels via RSS (0 quota) and ingests new videos
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { syncChannel } from '@/lib/sync/channel-sync';

export const maxDuration = 300; // 5 minutes for batch processing

// Fallback so a missing MONITORED_CHANNEL_IDS does not silently disable the job.
// This is the "Festo Service" channel — the primary source, not a secret.
const DEFAULT_CHANNEL_IDS = 'UCswhE6URzxILULeMYqOC1Cg';

// Videos ingested per channel per run. Each one costs a YouTube API call, a
// transcript fetch and one embedding + summary pass per chunk, so the cap keeps
// a run inside the function time limit. Leftovers are ingested by the next run.
const DEFAULT_MAX_VIDEOS_PER_RUN = 4;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for scheduled crons)
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const channelIdsEnv = process.env.MONITORED_CHANNEL_IDS;
  if (!channelIdsEnv) {
    console.warn(
      `[sync-channels] MONITORED_CHANNEL_IDS not set, falling back to ${DEFAULT_CHANNEL_IDS}`
    );
  }

  const channelIds = (channelIdsEnv || DEFAULT_CHANNEL_IDS)
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (channelIds.length === 0) {
    return NextResponse.json(
      { error: 'No channel IDs configured' },
      { status: 500 }
    );
  }

  const parsedMax = Number(process.env.SYNC_MAX_VIDEOS_PER_RUN);
  const maxVideos =
    Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : DEFAULT_MAX_VIDEOS_PER_RUN;

  try {
    const results = [];

    for (const channelId of channelIds) {
      console.log(`[sync-channels] Syncing channel ${channelId}...`);
      try {
        const result = await syncChannel(channelId, maxVideos);
        results.push(result);
      } catch (error) {
        console.error(`[sync-channels] Channel ${channelId} failed:`, error);
        results.push({
          channelId,
          source: 'error' as const,
          candidateCount: 0,
          newVideoIds: [],
          ingested: 0,
          deferred: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    const totalChecked = results.reduce((sum, r) => sum + r.candidateCount, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newVideoIds.length, 0);
    const totalIngested = results.reduce((sum, r) => sum + r.ingested, 0);
    const totalDeferred = results.reduce((sum, r) => sum + r.deferred, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(
      `[sync-channels] Done: ${totalIngested} ingested, ${totalDeferred} deferred, ${totalErrors} error(s)`
    );

    return NextResponse.json({
      success: true,
      channelsSynced: channelIds.length,
      maxVideosPerRun: maxVideos,
      totalChecked,
      totalNew,
      totalIngested,
      totalDeferred,
      totalErrors,
      channels: results,
    });
  } catch (error) {
    console.error('[sync-channels] Cron job failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
