// Cron job endpoint for channel synchronization
// Polls monitored YouTube channels via RSS (0 quota) and ingests new videos
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { syncChannel } from '@/lib/sync/channel-sync';

export const maxDuration = 300; // 5 minutes for batch processing

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
    return NextResponse.json(
      { error: 'MONITORED_CHANNEL_IDS not configured' },
      { status: 500 }
    );
  }

  const channelIds = channelIdsEnv
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (channelIds.length === 0) {
    return NextResponse.json(
      { error: 'No channel IDs configured' },
      { status: 500 }
    );
  }

  try {
    const results = [];

    for (const channelId of channelIds) {
      console.log(`[sync-channels] Syncing channel ${channelId}...`);
      try {
        const result = await syncChannel(channelId);
        results.push(result);
      } catch (error) {
        console.error(`[sync-channels] Channel ${channelId} failed:`, error);
        results.push({
          channelId,
          source: 'error' as const,
          candidateCount: 0,
          newVideoIds: [],
          ingested: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    const totalChecked = results.reduce((sum, r) => sum + r.candidateCount, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newVideoIds.length, 0);
    const totalIngested = results.reduce((sum, r) => sum + r.ingested, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return NextResponse.json({
      success: true,
      channelsSynced: channelIds.length,
      totalChecked,
      totalNew,
      totalIngested,
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
