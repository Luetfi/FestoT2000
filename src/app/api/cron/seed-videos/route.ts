// Cron job endpoint for periodic seed query indexing
// Searches YouTube for seed queries and processes found videos directly
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { ingestVideo } from '@/lib/ingestion/pipeline';
import { SEED_QUERIES } from '@/lib/ingestion/seeds';

export const maxDuration = 300; // 5 minutes for batch processing

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
    const videoIds: string[] = [];
    const errors: string[] = [];

    // Search for each seed query
    for (const { query, lang } of SEED_QUERIES) {
      try {
        const response = await youtube.search.list({
          part: ['id'],
          q: query,
          type: ['video'],
          maxResults: 10,
          order: 'date',
          relevanceLanguage: lang,
        });

        const ids = response.data.items
          ?.filter((item) => item.id?.videoId)
          .map((item) => item.id!.videoId!) ?? [];

        videoIds.push(...ids);
      } catch (error: unknown) {
        const errorMessage = `Query "${query}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    // Deduplicate video IDs
    const uniqueVideoIds = Array.from(new Set(videoIds));

    // Process videos directly
    const results = [];
    for (const videoId of uniqueVideoIds) {
      console.log(`Ingesting ${videoId} (${results.length + 1}/${uniqueVideoIds.length})...`);
      const result = await ingestVideo(videoId);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const noTranscript = results.filter((r) => r.status === 'no_transcript').length;

    return NextResponse.json({
      success: true,
      queriesSearched: SEED_QUERIES.length,
      queryErrors: errors.length,
      totalVideosFound: videoIds.length,
      uniqueVideosProcessed: uniqueVideoIds.length,
      succeeded,
      noTranscript,
      failed,
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
