// OpenAI embeddings client - server-only
// Embedding API key is never exposed to client
import 'server-only';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  _openai = new OpenAI({
    apiKey,
  });

  return _openai;
}

// Model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 2048; // OpenAI limit per request

export { EMBEDDING_DIMENSIONS };

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 * OpenAI allows up to 2048 inputs per request
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Handle batching for large inputs
  if (texts.length > MAX_BATCH_SIZE) {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddingsBatch(batch);
      results.push(...batchEmbeddings);
    }
    return results;
  }

  return generateEmbeddingsBatch(texts);
}

/**
 * Internal: Generate embeddings for a single batch (max 2048)
 */
async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    });

    // Sort by index to maintain order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  } catch (error) {
    // Handle rate limiting with exponential backoff
    if (error instanceof OpenAI.RateLimitError) {
      console.warn('OpenAI rate limit hit, waiting before retry...');
      await sleep(1000);
      return generateEmbeddingsBatch(texts);
    }
    throw error;
  }
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate embedding dimensions match expected
 * Use before inserting into database to catch dimension mismatches
 */
export function validateEmbedding(embedding: number[]): boolean {
  return embedding.length === EMBEDDING_DIMENSIONS;
}
