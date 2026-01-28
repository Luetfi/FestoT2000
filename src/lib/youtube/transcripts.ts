// YouTube transcript fetching - server-only
// Fetch transcripts with timestamps, graceful error handling
import 'server-only';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Transcript segment with timestamp metadata
 * Timestamps are in milliseconds from youtube-transcript library
 */
export interface TranscriptSegment {
  text: string;
  offset: number; // milliseconds from video start
  duration: number; // milliseconds duration of segment
}

/**
 * Result of transcript fetch attempt
 * Always returns an object, never throws
 */
export interface TranscriptResult {
  segments: TranscriptSegment[];
  language: string; // 'de', 'en', or 'unknown'
  source: 'manual' | 'auto' | 'unknown';
  available: boolean;
}

/**
 * Fetch video transcript with fallback strategy
 * Try German first, then English, graceful error handling
 *
 * @param videoId - YouTube video ID
 * @returns TranscriptResult with available: false if transcript unavailable
 */
export async function fetchVideoTranscript(
  videoId: string
): Promise<TranscriptResult> {
  // Try German first (primary target audience)
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'de',
    });

    return {
      segments: transcript.map((item) => ({
        text: item.text,
        offset: item.offset,
        duration: item.duration,
      })),
      language: 'de',
      source: determineSource(),
      available: true,
    };
  } catch {
    // German transcript unavailable, try English fallback
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });

      return {
        segments: transcript.map((item) => ({
          text: item.text,
          offset: item.offset,
          duration: item.duration,
        })),
        language: 'en',
        source: determineSource(),
        available: true,
      };
    } catch (fallbackError) {
      // No transcript available in either language
      console.warn(
        `Transcript unavailable for video ${videoId}:`,
        fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
      );

      return {
        segments: [],
        language: 'unknown',
        source: 'unknown',
        available: false,
      };
    }
  }
}

/**
 * Determine if transcript is manual or auto-generated
 * youtube-transcript library doesn't provide metadata, so default to unknown
 * Future: Could be enhanced with additional API calls if needed
 */
function determineSource(): 'manual' | 'auto' | 'unknown' {
  // youtube-transcript library doesn't expose source metadata
  // Could be enhanced by parsing transcript quality indicators
  return 'unknown';
}
