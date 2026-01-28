// Inngest client and function definitions for background jobs
// Handles async tasks that exceed Vercel serverless timeout
import { Inngest } from 'inngest';
import { ingestVideo } from '@/lib/ingestion/pipeline';

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

/**
 * Process a single video: fetch metadata, transcript, generate embeddings
 * Calls the full ingestion pipeline with automatic retries
 */
export const processVideo = inngest.createFunction(
  {
    id: 'process-video',
    name: 'Process Video',
    retries: 3,
  },
  { event: 'video/process' },
  async ({ event, step }) => {
    const { videoId, priority } = event.data;

    // Single step that runs the full ingestion pipeline
    // The pipeline handles all sub-operations (metadata, transcript, chunks, embeddings, storage)
    // If any step fails, Inngest will retry the entire function
    const result = await step.run('ingest-video', async () => {
      console.log(`Processing video ${videoId} (priority: ${priority || 'normal'})`);
      return await ingestVideo(videoId);
    });

    // Log result for monitoring
    if (result.status === 'success') {
      console.log(`Successfully processed ${videoId}: ${result.segmentCount} segments`);
    } else if (result.status === 'no_transcript') {
      console.log(`Video ${videoId} has no transcript available`);
    } else {
      console.error(`Failed to process ${videoId}: ${result.error}`);
    }

    return result;
  }
);

/**
 * Process multiple videos in batch
 * Fans out to individual video/process events for parallel processing
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

    console.log(`Processing batch of ${videoIds.length} videos from ${source}`);

    // Step 1: Send individual events for each video
    // This fans out the batch to parallel individual processing
    const queueResult = await step.run('queue-individual-videos', async () => {
      const events = videoIds.map((videoId: string) => ({
        name: 'video/process' as const,
        data: {
          videoId,
          priority: source === 'cron' ? ('low' as const) : ('normal' as const),
        },
      }));

      // Send all events at once using inngest.send
      await inngest.send(events);

      return { queued: videoIds.length };
    });

    console.log(`Queued ${queueResult.queued} videos for individual processing`);

    return {
      source,
      queued: queueResult.queued,
      status: 'dispatched',
    };
  }
);

// Export all functions for the serve handler
export const functions = [processVideo, processBatch];
