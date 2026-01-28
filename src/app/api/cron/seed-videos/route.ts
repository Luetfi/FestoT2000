// Cron job endpoint for periodic seed query indexing
// Protected by CRON_SECRET, searches YouTube for seed queries
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { inngest } from '@/lib/jobs/inngest';
import { getSeedQueries } from '@/lib/ingestion/seeds';

// Initialize YouTube client lazily
let _youtube: ReturnType<typeof google.youtube> | null = null;

function getYouTube() {
  if (_youtube) return _youtube;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY');
  }

  _youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  });

  return _youtube;
}

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

  try {
    const youtube = getYouTube();
    const seedQueries = await getSeedQueries();
    const videoIds: string[] = [];
    const errors: string[] = [];

    // Search for each seed query
    // Note: search.list costs 100 quota units per call (vs 1 for videos.list)
    // Limit to first 10 results per query to conserve quota
    for (const query of seedQueries) {
      try {
        const response = await youtube.search.list({
          part: ['id'],
          q: query,
          type: ['video'],
          maxResults: 10, // Limit per query for quota management
          order: 'date', // Prioritize recent videos
        });

        const ids = response.data.items
          ?.filter((item) => item.id?.videoId)
          .map((item) => item.id!.videoId!) ?? [];

        videoIds.push(...ids);
      } catch (error: unknown) {
        // Log and continue on individual query failures
        const errorMessage = `Query "${query}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    // Deduplicate video IDs
    const uniqueVideoIds = Array.from(new Set(videoIds));

    // Queue batch processing if we found videos
    if (uniqueVideoIds.length > 0) {
      await inngest.send({
        name: 'batch/process',
        data: {
          videoIds: uniqueVideoIds,
          source: 'cron',
        },
      });
    }

    return NextResponse.json({
      success: true,
      queriesSearched: seedQueries.length,
      queryErrors: errors.length,
      totalVideosFound: videoIds.length,
      uniqueVideosQueued: uniqueVideoIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
