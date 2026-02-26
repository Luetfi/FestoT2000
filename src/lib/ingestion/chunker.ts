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
 * Chunk transcript into overlapping segments
 * Target 600-1200 characters (roughly 30-60 seconds of speech)
 * with 15% overlap to preserve context at boundaries
 *
 * @param segments - Transcript segments with millisecond timestamps
 * @param targetChunkSize - Target characters per chunk (default 800)
 * @param overlapPercent - Overlap percentage as decimal (default 0.15 = 15%)
 * @returns Array of chunks with second-based timestamps
 */
export function chunkTranscript(
  segments: TranscriptSegment[],
  targetChunkSize = 800,
  overlapPercent = 0.15
): Chunk[] {
  // Handle empty input
  if (segments.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  const overlapSize = Math.floor(targetChunkSize * overlapPercent);

  let currentText = '';
  let currentStartOffset = segments[0].offset; // milliseconds
  let currentEndOffset = segments[0].offset; // milliseconds
  let lastSegmentIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentText = segment.text.trim();

    // Add space if not first segment in chunk
    const textToAdd = currentText.length > 0 ? ' ' + segmentText : segmentText;
    currentText += textToAdd;
    currentEndOffset = segment.offset + segment.duration;

    // Check if we've reached target chunk size
    if (currentText.length >= targetChunkSize) {
      // Push current chunk
      chunks.push({
        text: currentText.trim(),
        startTime: currentStartOffset / 1000, // convert ms to seconds
        endTime: currentEndOffset / 1000, // convert ms to seconds
        characterCount: currentText.trim().length,
      });

      // Start new chunk with overlap, snapped to sentence boundary
      if (currentText.length > overlapSize) {
        const rawOverlap = currentText.slice(-overlapSize);

        // Try to snap overlap to the first sentence boundary
        // (punctuation followed by whitespace and uppercase letter)
        const sentenceMatch = rawOverlap.match(/[.!?]\s+([A-ZÄÖÜ])/);
        let overlapText: string;
        let charsDropped: number;

        if (sentenceMatch && sentenceMatch.index !== undefined) {
          const sentenceStart = sentenceMatch.index + sentenceMatch[0].length - 1;
          // Only snap if we keep at least 30% of overlap for context
          if (sentenceStart < rawOverlap.length * 0.7) {
            overlapText = rawOverlap.slice(sentenceStart);
            charsDropped = overlapSize - overlapText.length;
          } else {
            overlapText = rawOverlap;
            charsDropped = 0;
          }
        } else {
          overlapText = rawOverlap;
          charsDropped = 0;
        }

        // Estimate overlap start time proportionally within the chunk's time range
        const overlapFraction =
          (currentText.length - overlapSize + charsDropped) / currentText.length;
        const overlapStartOffset =
          currentStartOffset +
          Math.floor((currentEndOffset - currentStartOffset) * overlapFraction);

        currentText = overlapText;
        currentStartOffset = overlapStartOffset;
        lastSegmentIndex = i;
      } else {
        // Chunk smaller than overlap, start fresh
        currentText = '';
        if (i + 1 < segments.length) {
          currentStartOffset = segments[i + 1].offset;
          lastSegmentIndex = i + 1;
        }
      }
    }
  }

  // Push final chunk if any text remains
  if (currentText.trim().length > 0) {
    chunks.push({
      text: currentText.trim(),
      startTime: currentStartOffset / 1000, // convert ms to seconds
      endTime: currentEndOffset / 1000, // convert ms to seconds
      characterCount: currentText.trim().length,
    });
  }

  return chunks;
}
