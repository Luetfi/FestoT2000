// Seed endpoint
// GET: discovers videos via YouTube Search API (expensive: 100 units/query)
// POST: ingests videos by ID directly (cheap: 1 unit/video)
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { searchVideos } from '@/lib/youtube/api';
import { ingestVideo, IngestionResult } from '@/lib/ingestion/pipeline';
import { SEED_QUERIES } from '@/lib/ingestion/seeds';

const TARGET_VIDEO_COUNT = 50;
const VIDEOS_PER_QUERY = 6;

export const maxDuration = 300; // 5 minutes for Vercel

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  const hasValidSecret =
    process.env.INGESTION_SECRET &&
    authHeader === `Bearer ${process.env.INGESTION_SECRET}`;

  if (!isDev && !hasValidSecret) {
    return NextResponse.json(
      { error: 'Only available in development or with INGESTION_SECRET' },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  const log = (msg: string) => console.log(`[seed] ${msg}`);

  try {
    // ── Step 1: Clean ALL existing data (FK order: segments → transcripts → videos → channels) ──
    log('Cleaning all existing data...');

    const { data: allVideos } = await supabase.from('videos').select('id');
    const allVideoIds = (allVideos ?? []).map((v: { id: number }) => v.id);

    if (allVideoIds.length > 0) {
      await supabase.from('segments').delete().in('video_id', allVideoIds);
      await supabase.from('transcripts').delete().in('video_id', allVideoIds);
    }

    await supabase.from('videos').delete().neq('id', 0);
    await supabase.from('channels').delete().neq('id', 0);
    await supabase.from('search_cache').delete().neq('id', 0);

    log('Cleanup done');

    // ── Step 2: Discover video IDs via YouTube Search API ──
    log(`Searching videos with ${SEED_QUERIES.length} queries (${VIDEOS_PER_QUERY} per query)...`);

    const discoveredIds = new Set<string>();

    for (const { query, lang } of SEED_QUERIES) {
      try {
        const ids = await searchVideos(query, VIDEOS_PER_QUERY, lang);
        for (const id of ids) {
          discoveredIds.add(id);
        }
        log(`  [${lang}] "${query}" → ${ids.length} videos (total unique: ${discoveredIds.size})`);
      } catch (err) {
        log(`  [${lang}] "${query}" → ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (discoveredIds.size >= TARGET_VIDEO_COUNT * 2.5) {
        log('  Enough candidates, stopping search early');
        break;
      }
    }

    const videoIds = Array.from(discoveredIds);
    log(`Discovered ${discoveredIds.size} unique candidate videos`);

    if (videoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No videos found via YouTube Search API' },
        { status: 500 }
      );
    }

    // ── Step 3: Ingest videos until TARGET_VIDEO_COUNT successes ──
    const results: IngestionResult[] = [];
    let successCount = 0;

    for (let i = 0; i < videoIds.length; i++) {
      if (successCount >= TARGET_VIDEO_COUNT) {
        log(`Reached ${TARGET_VIDEO_COUNT} successful videos, stopping ingestion`);
        break;
      }

      const videoId = videoIds[i];
      log(`Ingesting ${i + 1}/${videoIds.length}: ${videoId} (${successCount}/${TARGET_VIDEO_COUNT} successful)...`);

      const result = await ingestVideo(videoId);
      results.push(result);

      if (result.status === 'success') {
        successCount++;
      }

      const statusLabel =
        result.status === 'success' ? 'OK' :
        result.status === 'no_transcript' ? 'NO_TRANSCRIPT' : 'ERROR';
      log(`  ${statusLabel} - ${result.segmentCount} segments${result.error ? ` (${result.error})` : ''}`);
    }

    // ── Step 4: Summary ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = results.filter((r) => r.status === 'success');
    const noTranscript = results.filter((r) => r.status === 'no_transcript');
    const errors = results.filter((r) => r.status === 'error');
    const totalSegments = results.reduce((sum, r) => sum + r.segmentCount, 0);

    log(`Done in ${elapsed}s: ${successful.length}/${TARGET_VIDEO_COUNT} success, ${noTranscript.length} no transcript, ${errors.length} errors, ${totalSegments} total segments`);

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      summary: {
        targetCount: TARGET_VIDEO_COUNT,
        targetReached: successful.length >= TARGET_VIDEO_COUNT,
        totalDiscovered: discoveredIds.size,
        totalAttempted: results.length,
        successful: successful.length,
        noTranscript: noTranscript.length,
        errors: errors.length,
        totalSegments,
      },
      results: results.map((r) => ({
        videoId: r.videoId,
        status: r.status,
        segments: r.segmentCount,
        error: r.error || undefined,
      })),
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[seed] Fatal error after ${elapsed}s:`, err);
    return NextResponse.json(
      {
        success: false,
        elapsed: `${elapsed}s`,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seed — Ingest videos by ID directly (no Search API needed)
 * Body: { videoIds: string[], clean?: boolean }
 * Costs only 1 YouTube API unit per video (metadata fetch)
 */
export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  const hasValidSecret =
    process.env.INGESTION_SECRET &&
    authHeader === `Bearer ${process.env.INGESTION_SECRET}`;

  if (!isDev && !hasValidSecret) {
    return NextResponse.json(
      { error: 'Only available in development or with INGESTION_SECRET' },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 });
  }

  let body: { videoIds?: string[]; clean?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { videoIds, clean = false } = body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return NextResponse.json(
      { error: 'Body must contain videoIds: string[]' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  const log = (msg: string) => console.log(`[seed:direct] ${msg}`);

  try {
    if (clean) {
      log('Cleaning all existing data...');
      const { data: allVideos } = await supabase.from('videos').select('id');
      const allDbIds = (allVideos ?? []).map((v: { id: number }) => v.id);
      if (allDbIds.length > 0) {
        await supabase.from('segments').delete().in('video_id', allDbIds);
        await supabase.from('transcripts').delete().in('video_id', allDbIds);
      }
      await supabase.from('videos').delete().neq('id', 0);
      await supabase.from('channels').delete().neq('id', 0);
      await supabase.from('search_cache').delete().neq('id', 0);
      log('Cleanup done');
    }

    log(`Ingesting ${videoIds.length} videos by ID...`);
    const results: IngestionResult[] = [];

    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      log(`Ingesting ${i + 1}/${videoIds.length}: ${videoId}...`);

      const result = await ingestVideo(videoId);
      results.push(result);

      const statusLabel =
        result.status === 'success' ? 'OK' :
        result.status === 'no_transcript' ? 'NO_TRANSCRIPT' : 'ERROR';
      log(`  ${statusLabel} - ${result.segmentCount} segments${result.error ? ` (${result.error})` : ''}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = results.filter((r) => r.status === 'success');
    const noTranscript = results.filter((r) => r.status === 'no_transcript');
    const errors = results.filter((r) => r.status === 'error');
    const totalSegments = results.reduce((sum, r) => sum + r.segmentCount, 0);

    log(`Done in ${elapsed}s: ${successful.length} success, ${noTranscript.length} no transcript, ${errors.length} errors, ${totalSegments} total segments`);

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      summary: {
        totalProvided: videoIds.length,
        successful: successful.length,
        noTranscript: noTranscript.length,
        errors: errors.length,
        totalSegments,
      },
      results: results.map((r) => ({
        videoId: r.videoId,
        status: r.status,
        segments: r.segmentCount,
        error: r.error || undefined,
      })),
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[seed:direct] Fatal error after ${elapsed}s:`, err);
    return NextResponse.json(
      { success: false, elapsed: `${elapsed}s`, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
