// Transcript chunking with overlap - server-only
// Segment transcripts into 30-60 second chunks with overlap
import 'server-only';
import type { TranscriptSegment } from '@/lib/youtube/transcripts';

/**
 * Chunk of transcript text with timestamp boundaries
 * Timestamps are in seconds (converted from ms segments)
 */
export interface Chunk {
  text: string;
  startTime: number; // seconds from video start
  endTime: number; // seconds from video end
  characterCount: number;
}

/**
 * Chunk transcript into sequential, non-overlapping segments
 * Target ~800 characters per chunk (roughly 30-60 seconds of speech)
 * Each segment starts exactly where the previous one ended — no gaps, no overlap.
 *
 * @param segments - Transcript segments with millisecond timestamps
 * @param targetChunkSize - Target characters per chunk (default 800)
 * @returns Array of chunks with second-based timestamps
 */
export function chunkTranscript(
  segments: TranscriptSegment[],
  targetChunkSize = 800,
): Chunk[] {
  if (segments.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];

  let currentText = '';
  let currentStartOffset = segments[0].offset; // milliseconds
  let currentEndOffset = segments[0].offset; // milliseconds

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentText = segment.text.trim();

    const textToAdd = currentText.length > 0 ? ' ' + segmentText : segmentText;
    currentText += textToAdd;
    currentEndOffset = segment.offset + segment.duration;

    if (currentText.length >= targetChunkSize) {
      chunks.push({
        text: currentText.trim(),
        startTime: currentStartOffset / 1000,
        endTime: currentEndOffset / 1000,
        characterCount: currentText.trim().length,
      });

      // Next chunk starts exactly where this one ended
      currentText = '';
      currentStartOffset = currentEndOffset;
    }
  }

  // Final chunk for remaining text
  if (currentText.trim().length > 0) {
    chunks.push({
      text: currentText.trim(),
      startTime: currentStartOffset / 1000,
      endTime: currentEndOffset / 1000,
      characterCount: currentText.trim().length,
    });
  }

  return chunks;
}
