// Protected ingestion endpoint for manual video ingestion
// Requires INGESTION_SECRET header for access
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
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
  let body: { videoId?: string; videoIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { videoId, videoIds } = body;

  // Handle single video
  if (videoId && typeof videoId === 'string') {
    const result = await ingestVideo(videoId);

    return NextResponse.json({
      success: result.status === 'success',
      videoId,
      result,
    });
  }

  // Handle batch of videos
  if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
    if (!videoIds.every((id) => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All videoIds must be strings' },
        { status: 400 }
      );
    }

    const results = [];
    for (const id of videoIds) {
      console.log(`Ingesting ${id} (${results.length + 1}/${videoIds.length})...`);
      const result = await ingestVideo(id);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const noTranscript = results.filter((r) => r.status === 'no_transcript').length;

    return NextResponse.json({
      success: true,
      total: videoIds.length,
      succeeded,
      noTranscript,
      failed,
      results,
    });
  }

  // Neither videoId nor videoIds provided
  return NextResponse.json(
    { error: 'Missing videoId or videoIds in request body' },
    { status: 400 }
  );
}
