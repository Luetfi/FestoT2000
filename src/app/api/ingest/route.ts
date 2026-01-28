// Protected ingestion endpoint for manual video ingestion
// Requires INGESTION_SECRET header for access
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/jobs/inngest';
import { ratelimit } from '@/lib/rate-limit';

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

  // Rate limiting (even for authenticated requests)
  if (ratelimit) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const { success } = await ratelimit.limit(`ingest:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen – bitte kurz warten' },
        { status: 429 }
      );
    }
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
    await inngest.send({
      name: 'video/process',
      data: { videoId, priority: 'normal' },
    });

    return NextResponse.json({
      success: true,
      queued: 1,
      videoId,
    });
  }

  // Handle batch of videos
  if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
    // Validate all IDs are strings
    if (!videoIds.every((id) => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All videoIds must be strings' },
        { status: 400 }
      );
    }

    await inngest.send({
      name: 'batch/process',
      data: { videoIds, source: 'manual' },
    });

    return NextResponse.json({
      success: true,
      queued: videoIds.length,
      source: 'manual',
    });
  }

  // Neither videoId nor videoIds provided
  return NextResponse.json(
    { error: 'Missing videoId or videoIds in request body' },
    { status: 400 }
  );
}
