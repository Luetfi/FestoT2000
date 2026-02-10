// YouTube API integration test
import { NextResponse } from 'next/server';
import { fetchVideoMetadata } from '@/lib/youtube/api';
import { rateLimitMiddleware } from '@/lib/rate-limit';

// Test video: Official Festo video (short, always available)
const TEST_VIDEO_ID = 'dQw4w9WgXcQ'; // Replace with actual Festo video ID in production

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Allow custom video ID via query param for testing
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || TEST_VIDEO_ID;

  try {
    const startTime = Date.now();
    const metadata = await fetchVideoMetadata(videoId);
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      latency_ms: latencyMs,
      video: {
        id: metadata.videoId,
        title: metadata.title,
        channel: metadata.channelTitle,
        duration_seconds: metadata.durationSeconds,
        has_thumbnail: !!metadata.thumbnailUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
