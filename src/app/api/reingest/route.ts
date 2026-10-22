// Re-ingestion endpoint: re-processes all existing videos with updated chunker
// Requires INGESTION_SECRET header for access
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ingestVideo } from '@/lib/ingestion/pipeline';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  // Verify secret header
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.INGESTION_SECRET}`;

  if (!process.env.INGESTION_SECRET) {
    return NextResponse.json(
      { error: 'INGESTION_SECRET not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all youtube_ids from the database
    let videos: { youtube_id: string }[];
    try {
      videos = await query<{ youtube_id: string }>('SELECT youtube_id FROM videos');
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch videos from database' },
        { status: 500 }
      );
    }

    if (videos.length === 0) {
      return NextResponse.json({ message: 'No videos in database', processed: 0 });
    }

    const videoIds = videos.map((v) => v.youtube_id);

    // Process all videos directly
    const results = [];
    for (const videoId of videoIds) {
      console.log(`Re-ingesting ${videoId} (${results.length + 1}/${videoIds.length})...`);
      const result = await ingestVideo(videoId);
      results.push(result);
      console.log(`  → ${result.status} (${result.segmentCount} segments)`);
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const noTranscript = results.filter((r) => r.status === 'no_transcript').length;

    return NextResponse.json({
      success: true,
      message: `Re-ingestion complete: ${succeeded} succeeded, ${noTranscript} no transcript, ${failed} failed`,
      total: videoIds.length,
      succeeded,
      noTranscript,
      failed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
