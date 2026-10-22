// Channel ingestion endpoint - fetches all videos from a YouTube channel
// and processes them through the ingestion pipeline.
// Protected by INGESTION_SECRET like /api/ingest.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelVideoIds } from '@/lib/youtube/api';
import { ingestVideo } from '@/lib/ingestion/pipeline';

export const maxDuration = 300; // 5 minutes for batch processing

export async function POST(request: NextRequest) {
  // Verify secret header
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.INGESTION_SECRET}`;

  if (!process.env.INGESTION_SECRET) {
    console.error('INGESTION_SECRET not configured');
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

  // Parse request body
  let body: { channelId?: string; maxVideos?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { channelId, maxVideos } = body;

  if (!channelId || typeof channelId !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid channelId in request body' },
      { status: 400 }
    );
  }

  // Validate maxVideos if provided
  const cap = typeof maxVideos === 'number' && maxVideos > 0
    ? Math.min(maxVideos, 2000)
    : 500;

  try {
    // Fetch all video IDs from the channel's uploads playlist
    const videoIds = await fetchChannelVideoIds(channelId, cap);

    if (videoIds.length === 0) {
      return NextResponse.json({
        success: true,
        channelId,
        totalVideos: 0,
        processed: 0,
        message: 'No videos found for this channel',
      });
    }

    // Process all videos directly
    const results = [];
    for (const videoId of videoIds) {
      console.log(`Ingesting ${videoId} (${results.length + 1}/${videoIds.length})...`);
      const result = await ingestVideo(videoId);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const noTranscript = results.filter((r) => r.status === 'no_transcript').length;

    return NextResponse.json({
      success: true,
      channelId,
      totalVideos: videoIds.length,
      succeeded,
      noTranscript,
      failed,
      results,
    });
  } catch (error: unknown) {
    console.error(`Channel ingestion failed for ${channelId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
