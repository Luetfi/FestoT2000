// Embeddings via Amazon Bedrock (Titan Text Embeddings V2) - server-only
import 'server-only';
import { embed, EMBEDDING_DIMENSIONS } from '@/lib/ai/bedrock';

// Titan V2 embeds one text per request; run a few in parallel.
const CONCURRENCY_LIMIT = 8;

export { EMBEDDING_DIMENSIONS };

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return embed(text);
}

/**
 * Generate embeddings for multiple texts, order preserved
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += CONCURRENCY_LIMIT) {
    const batch = texts.slice(i, i + CONCURRENCY_LIMIT);
    const embeddings = await Promise.all(batch.map((text) => embed(text)));
    embeddings.forEach((embedding, j) => {
      results[i + j] = embedding;
    });
  }
  return results;
}

/**
 * Validate embedding dimensions match expected
 * Use before inserting into database to catch dimension mismatches
 */
export function validateEmbedding(embedding: number[]): boolean {
  return embedding.length === EMBEDDING_DIMENSIONS;
}
