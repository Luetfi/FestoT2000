// Main ingestion pipeline orchestration - server-only
// Complete flow from video ID to stored embeddings
import 'server-only';

import { fetchVideoMetadata, fetchChannelMetadata, classifyChannel } from '@/lib/youtube/api';
import { fetchVideoTranscript } from '@/lib/youtube/transcripts';
import { chunkTranscript } from '@/lib/ingestion/chunker';
import { generateEmbeddings, validateEmbedding, EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings';
import { generateSummaries } from '@/lib/ai/summaries';
import { gateVideo } from '@/lib/ingestion/relevance-gate';
import { query, queryOne, toVector } from '@/lib/db';

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
    const existingChannel = await queryOne<{ id: number }>(
      'SELECT id FROM channels WHERE youtube_id = $1',
      [metadata.channelId]
    );

    if (existingChannel) {
      channelDbId = existingChannel.id;
    } else {
      // Fetch channel metadata and classify as official/community
      const channelMeta = await fetchChannelMetadata(metadata.channelId);
      const newChannel = await queryOne<{ id: number }>(
        `INSERT INTO channels (youtube_id, name, description, thumbnail_url, official_status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          channelMeta.channelId,
          channelMeta.name,
          channelMeta.description,
          channelMeta.thumbnailUrl,
          classifyChannel(channelMeta.name),
        ]
      );

      if (!newChannel) throw new Error('Failed to create channel');
      channelDbId = newChannel.id;
    }

    // Upsert video with has_transcript: false initially
    // ON CONFLICT for idempotent re-ingestion
    const video = await queryOne<{ id: number }>(
      `INSERT INTO videos (youtube_id, channel_id, title, description, thumbnail_url,
                           duration_seconds, published_at, has_transcript, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
       ON CONFLICT (youtube_id) DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         thumbnail_url = EXCLUDED.thumbnail_url,
         duration_seconds = EXCLUDED.duration_seconds,
         published_at = EXCLUDED.published_at,
         has_transcript = EXCLUDED.has_transcript,
         review_status = EXCLUDED.review_status
       RETURNING id`,
      [
        videoId,
        channelDbId,
        metadata.title,
        metadata.description,
        metadata.thumbnailUrl,
        metadata.durationSeconds,
        metadata.publishedAt,
        reviewStatus,
      ]
    );

    if (!video) throw new Error('Failed to upsert video');

    // Fetch transcript (German first, then English fallback)
    const transcriptResult = await fetchVideoTranscript(videoId);

    if (!transcriptResult.available) {
      // Transcript unavailable → not searchable. Mark not-approved so it isn't
      // counted as a live video or listed for review.
      await query(
        `UPDATE videos SET review_status = 'rejected', relevance_reason = $2 WHERE id = $1`,
        [video.id, 'Kein DE/EN-Transkript verfügbar']
      );
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
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
        await query(
          `UPDATE videos
           SET review_status = 'rejected', relevance_score = $2, relevance_reason = $3,
               content_type = $4, has_transcript = false
           WHERE id = $1`,
          [video.id, gate.score, gate.reason, gate.contentType]
        );

        return {
          videoId,
          status: 'rejected_irrelevant',
          segmentCount: 0,
          channelId: channelDbId,
          videoDbId: video.id,
        };
      }
    }

    // Delete old transcripts (cascades to segments) for idempotent re-ingestion
    await query('DELETE FROM transcripts WHERE video_id = $1', [video.id]);

    // Store transcript in database
    const transcript = await queryOne<{ id: number }>(
      `INSERT INTO transcripts (video_id, full_text, language, source_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [video.id, fullText, transcriptResult.language, transcriptResult.source]
    );

    if (!transcript) throw new Error('Failed to insert transcript');

    // Update video.has_transcript flag
    await query('UPDATE videos SET has_transcript = true WHERE id = $1', [video.id]);

    // Chunk transcript into non-overlapping segments of roughly one minute
    const chunks = chunkTranscript(transcriptResult.segments);
    if (chunks.length === 0) {
      // Empty transcript - treat as unavailable (and not approved/searchable).
      await query(
        `UPDATE videos SET review_status = 'rejected', relevance_reason = $2 WHERE id = $1`,
        [video.id, 'Leeres Transkript']
      );
      return {
        videoId,
        status: 'no_transcript',
        segmentCount: 0,
        channelId: channelDbId,
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
          `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
        );
      }
    }

    // Store segments with embeddings in one statement: one array per column,
    // expanded row-wise by unnest.
    await query(
      `INSERT INTO segments (video_id, transcript_id, text, summary, start_time, end_time, embedding)
       SELECT $1, $2, t.text, t.summary, t.start_time, t.end_time, t.embedding::vector
       FROM unnest($3::text[], $4::text[], $5::float8[], $6::float8[], $7::text[])
         AS t(text, summary, start_time, end_time, embedding)`,
      [
        video.id,
        transcript.id,
        chunks.map((chunk) => chunk.text),
        chunks.map((_, index) => summaries[index] || null),
        chunks.map((chunk) => chunk.startTime),
        chunks.map((chunk) => chunk.endTime),
        embeddings.map(toVector),
      ]
    );

    // Persist the gate verdict on the (now ingested) video for the reviewer.
    // review_status keeps the value set at upsert (e.g. 'pending').
    if (options.gate) {
      await query(
        `UPDATE videos SET relevance_score = $2, relevance_reason = $3, content_type = $4
         WHERE id = $1`,
        [video.id, gateScore, gateReason, gateContentType]
      );
    }

    // Success - return result with counts
    return {
      videoId,
      status: 'success',
      segmentCount: chunks.length,
      channelId: channelDbId,
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
