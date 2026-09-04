// Main ingestion pipeline orchestration - server-only
// Complete flow from video ID to stored embeddings
import 'server-only';

import { fetchVideoMetadata, fetchChannelMetadata, classifyChannel } from '@/lib/youtube/api';
import { fetchVideoTranscript } from '@/lib/youtube/transcripts';
import { chunkTranscript } from '@/lib/ingestion/chunker';
import { generateEmbeddings, validateEmbedding } from '@/lib/openai/embeddings';
import { generateSummaries } from '@/lib/openai/summaries';
import { gateVideo } from '@/lib/ingestion/relevance-gate';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Result of video ingestion attempt
 * Provides structured feedback for monitoring and error handling
 */
export interface IngestionResult {
  videoId: string;
  status: 'success' | 'no_transcript' | 'error' | 'rejected_irrelevant';
  segmentCount: number;
  error?: string;
  channelId?: number;
  videoDbId?: number;
}

/**
 * Options controlling ingestion behaviour.
 * Defaults preserve the original behaviour (no gate, immediately approved) so
 * existing callers (/api/ingest, channel ingestion) are unaffected.
 */
export interface IngestOptions {
  /** Run the relevance gate before embedding (used for community ingestion). */
  gate?: boolean;
  /** review_status to assign on a successful ingest. Default 'approved'. */
  reviewStatus?: 'approved' | 'pending';
}

/**
 * Ingest a single video: metadata -> channel -> video -> transcript -> chunks -> embeddings -> storage
 * Video metadata fetching and storage
 * Channel metadata fetching and classification
 * Transcript fetching with graceful error handling
 * Transcript chunking with overlap
 * Embedding generation with validation
 * Database storage with foreign key relationships
 *
 * @param videoId - YouTube video ID
 * @returns IngestionResult with status and counts
 */
export async function ingestVideo(
  videoId: string,
  options: IngestOptions = {}
): Promise<IngestionResult> {
  const reviewStatus = options.reviewStatus ?? 'approved';
  try {
    // Fetch video metadata from YouTube Data API
    const metadata = await fetchVideoMetadata(videoId);

    // Upsert channel (check if exists first to avoid duplicate API calls)
    let channelDbId: number;
    const { data: existingChannel } = await getSupabaseAdmin()
      .from('channels')
      .select('id')
      .eq('youtube_id', metadata.channelId)
      .maybeSingle();

    if (existingChannel) {
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      channelDbId = existingChannel.id;
    } else {
      // Fetch channel metadata and classify as official/community
      const channelMeta = await fetchChannelMetadata(metadata.channelId);
      const { data: newChannel, error: channelError } = await getSupabaseAdmin()
        .from('channels')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .insert({
          youtube_id: channelMeta.channelId,
          name: channelMeta.name,
          description: channelMeta.description,
          thumbnail_url: channelMeta.thumbnailUrl,
          official_status: classifyChannel(channelMeta.name),
        })
        .select('id')
        .single();

      if (channelError || !newChannel) throw channelError || new Error('Failed to create channel');
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      channelDbId = newChannel.id;
    }

    // Upsert video with has_transcript: false initially
    // Use onConflict for idempotent re-ingestion
    const { data: video, error: videoError } = await getSupabaseAdmin()
      .from('videos')
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .upsert(
        {
          youtube_id: videoId,
          channel_id: channelDbId,
          title: metadata.title,
          description: metadata.description,
          thumbnail_url: metadata.thumbnailUrl,
          duration_seconds: metadata.durationSeconds,
          published_at: metadata.publishedAt,
          has_transcript: false,
          review_status: reviewStatus,
        },
        { onConflict: 'youtube_id' }
      )
      .select('id')
      .single();

    if (videoError || !video) throw videoError || new Error('Failed to upsert video');

    // Fetch transcript (German first, then English fallback)
    const transcriptResult = await fetchVideoTranscript(videoId);

    if (!transcriptResult.available) {
      // Transcript unavailable → not searchable. Mark not-approved so it isn't
      // counted as a live video or listed for review.
      await getSupabaseAdmin()
        .from('videos')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .update({ review_status: 'rejected', relevance_reason: 'Kein DE/EN-Transkript verfügbar' })
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .eq('id', video.id);
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        videoDbId: video.id,
      };
    }

    const fullText = transcriptResult.segments.map((s) => s.text).join(' ');

    // Optional relevance gate (community ingestion): reject clearly irrelevant
    // videos BEFORE spending embedding credits. The video row is kept and marked
    // 'rejected' (with score/reason) so discovery won't re-process it.
    let gateScore: number | null = null;
    let gateReason: string | null = null;
    let gateContentType: string | null = null;
    if (options.gate) {
      const gate = await gateVideo({
        title: metadata.title,
        description: metadata.description,
        transcript: fullText,
      });
      gateScore = gate.score;
      gateReason = gate.reason;
      gateContentType = gate.contentType;

      if (!gate.relevant) {
        await getSupabaseAdmin()
          .from('videos')
          // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
          .update({
            review_status: 'rejected',
            relevance_score: gate.score,
            relevance_reason: gate.reason,
            content_type: gate.contentType,
            has_transcript: false,
          })
          // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
          .eq('id', video.id);

        return {
          videoId,
          status: 'rejected_irrelevant',
          segmentCount: 0,
          channelId: channelDbId,
          // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
          videoDbId: video.id,
        };
      }
    }

    // Delete old transcripts (cascades to segments) for idempotent re-ingestion
    // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
    await getSupabaseAdmin().from('transcripts').delete().eq('video_id', video.id);

    // Store transcript in database
    const { data: transcript, error: transcriptError } = await getSupabaseAdmin()
      .from('transcripts')
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .insert({
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        video_id: video.id,
        full_text: fullText,
        language: transcriptResult.language,
        source_type: transcriptResult.source,
      })
      .select('id')
      .single();

    if (transcriptError || !transcript) throw transcriptError || new Error('Failed to insert transcript');

    // Update video.has_transcript flag
    await getSupabaseAdmin()
      .from('videos')
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .update({ has_transcript: true })
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .eq('id', video.id);

    // Chunk transcript into non-overlapping segments of roughly one minute
    const chunks = chunkTranscript(transcriptResult.segments);
    if (chunks.length === 0) {
      // Empty transcript - treat as unavailable (and not approved/searchable).
      await getSupabaseAdmin()
        .from('videos')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .update({ review_status: 'rejected', relevance_reason: 'Leeres Transkript' })
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .eq('id', video.id);
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        videoDbId: video.id,
      };
    }

    // Generate embeddings and summaries for all chunks in parallel
    const texts = chunks.map((c) => c.text);
    const [embeddings, summaries] = await Promise.all([
      generateEmbeddings(texts),
      generateSummaries(texts),
    ]);

    // Validate embedding dimensions before storage
    for (const embedding of embeddings) {
      if (!validateEmbedding(embedding)) {
        throw new Error(
          `Embedding dimension mismatch: expected 1536, got ${embedding.length}`
        );
      }
    }

    // Store segments with embeddings in database
    const segmentRecords = chunks.map((chunk, index) => ({
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      video_id: video.id,
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      transcript_id: transcript.id,
      text: chunk.text,
      summary: summaries[index] || null,
      start_time: chunk.startTime,
      end_time: chunk.endTime,
      embedding: embeddings[index],
    }));

    const { error: segmentError } = await getSupabaseAdmin()
      .from('segments')
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .insert(segmentRecords);

    if (segmentError) throw segmentError;

    // Persist the gate verdict on the (now ingested) video for the reviewer.
    // review_status keeps the value set at upsert (e.g. 'pending').
    if (options.gate) {
      await getSupabaseAdmin()
        .from('videos')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .update({
          relevance_score: gateScore,
          relevance_reason: gateReason,
          content_type: gateContentType,
        })
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .eq('id', video.id);
    }

    // Success - return result with counts
    return {
      videoId,
      status: 'success',
      segmentCount: chunks.length,
      channelId: channelDbId,
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      videoDbId: video.id,
    };
  } catch (error) {
    // Log error for debugging
    console.error(`Failed to ingest video ${videoId}:`, error);

    // Return error result with message
    return {
      videoId,
      status: 'error',
      segmentCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
