// Main ingestion pipeline orchestration - server-only
// Complete flow from video ID to stored embeddings
import 'server-only';

import { fetchVideoMetadata, fetchChannelMetadata, classifyChannel } from '@/lib/youtube/api';
import { fetchVideoTranscript } from '@/lib/youtube/transcripts';
import { chunkTranscript } from '@/lib/ingestion/chunker';
import { generateEmbeddings, validateEmbedding } from '@/lib/openai/embeddings';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Result of video ingestion attempt
 * Provides structured feedback for monitoring and error handling
 */
export interface IngestionResult {
  videoId: string;
  status: 'success' | 'no_transcript' | 'error';
  segmentCount: number;
  error?: string;
  channelId?: number;
  videoDbId?: number;
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
export async function ingestVideo(videoId: string): Promise<IngestionResult> {
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
        },
        { onConflict: 'youtube_id' }
      )
      .select('id')
      .single();

    if (videoError || !video) throw videoError || new Error('Failed to upsert video');

    // Fetch transcript (German first, then English fallback)
    const transcriptResult = await fetchVideoTranscript(videoId);

    if (!transcriptResult.available) {
      // Transcript unavailable - return early with status
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        videoDbId: video.id,
      };
    }

    // Store transcript in database
    const fullText = transcriptResult.segments.map((s) => s.text).join(' ');
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

    // Chunk transcript into 30-60 second segments with overlap
    const chunks = chunkTranscript(transcriptResult.segments);
    if (chunks.length === 0) {
      // Empty transcript - treat as unavailable
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        videoDbId: video.id,
      };
    }

    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

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
      start_time: chunk.startTime,
      end_time: chunk.endTime,
      embedding: embeddings[index],
    }));

    const { error: segmentError } = await getSupabaseAdmin()
      .from('segments')
      // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
      .insert(segmentRecords);

    if (segmentError) throw segmentError;

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
