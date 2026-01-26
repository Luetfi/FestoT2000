// Inngest client and function definitions for background jobs
// Handles async tasks that exceed Vercel serverless timeout
import { Inngest } from 'inngest';

// Create Inngest client
export const inngest = new Inngest({
  id: 'festot2000',
  name: 'Festo Video Search',
});

// Event types for type safety
export interface VideoProcessEvent {
  name: 'video/process';
  data: {
    videoId: string;
    priority?: 'high' | 'normal' | 'low';
  };
}

export interface BatchProcessEvent {
  name: 'batch/process';
  data: {
    videoIds: string[];
    source: 'seed' | 'cron' | 'manual';
  };
}

// Union of all events
export type InngestEvent = VideoProcessEvent | BatchProcessEvent;

// Placeholder function definitions
// Actual implementations will be added later (Ingestion Pipeline)

/**
 * Process a single video: fetch metadata, transcript, generate embeddings
 * This is a placeholder - full implementation later
 */
export const processVideo = inngest.createFunction(
  {
    id: 'process-video',
    name: 'Process Video',
    retries: 3,
  },
  { event: 'video/process' },
  async ({ event, step }) => {
    const { videoId } = event.data;

    // Step 1: Fetch video metadata (placeholder)
    const metadata = await step.run('fetch-metadata', async () => {
      // Will be implemented later
      console.log(`[Placeholder] Fetching metadata for ${videoId}`);
      return { videoId, status: 'placeholder' };
    });

    // Step 2: Fetch transcript (placeholder)
    const transcript = await step.run('fetch-transcript', async () => {
      // Will be implemented later
      console.log(`[Placeholder] Fetching transcript for ${videoId}`);
      return { text: '', segments: [] };
    });

    // Step 3: Generate embeddings (placeholder)
    await step.run('generate-embeddings', async () => {
      // Will be implemented later
      console.log(`[Placeholder] Generating embeddings for ${videoId}`);
      return { count: 0 };
    });

    return {
      videoId,
      status: 'placeholder',
      message: 'Full implementation later',
    };
  }
);

/**
 * Process multiple videos in batch
 * This is a placeholder - full implementation later
 */
export const processBatch = inngest.createFunction(
  {
    id: 'process-batch',
    name: 'Process Video Batch',
    retries: 2,
  },
  { event: 'batch/process' },
  async ({ event, step }) => {
    const { videoIds, source } = event.data;

    // Fan out to individual video processing
    await step.run('queue-videos', async () => {
      console.log(`[Placeholder] Queueing ${videoIds.length} videos from ${source}`);
      // Later: Send individual video/process events
      return { queued: videoIds.length };
    });

    return {
      source,
      queued: videoIds.length,
      status: 'placeholder',
    };
  }
);

// Export all functions for the serve handler
export const functions = [processVideo, processBatch];
