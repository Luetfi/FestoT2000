// YouTube transcript fetching - server-only
// Fetch transcripts with timestamps, graceful error handling
//
// NOTE: YouTube currently blocks server-side transcript fetching (timedtext API
// returns empty responses). The youtube-transcript library (v1.2.1) no longer
// works with YouTube's current infrastructure. This module is preserved for when
// a working solution is available (e.g. yt-dlp, updated library, or proxy).
// For now, the seed endpoint uses synthetic transcripts with real embeddings.
import 'server-only';

/**
 * Transcript segment with timestamp metadata
 * Timestamps are in milliseconds from video start
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
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'de',
    });

    if (transcript.length === 0) throw new Error('Empty transcript');

    return {
      segments: transcript.map((item) => ({
        text: item.text,
        offset: item.offset,
        duration: item.duration,
      })),
      language: 'de',
      source: 'unknown',
      available: true,
    };
  } catch {
    // German transcript unavailable, try English fallback
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });

      if (transcript.length === 0) throw new Error('Empty transcript');

      return {
        segments: transcript.map((item) => ({
          text: item.text,
          offset: item.offset,
          duration: item.duration,
        })),
        language: 'en',
        source: 'unknown',
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
