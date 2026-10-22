// Re-embedding endpoint: fills every segment without an embedding using the
// current embedding model. Used after switching models (the column is cleared
// first, see deploy/switch-to-bedrock.sh). Safe to call repeatedly - it only
// touches segments whose embedding IS NULL.
// Requires INGESTION_SECRET header for access
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query, toVector } from '@/lib/db';
import { generateEmbeddings, validateEmbedding, EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings';

export const maxDuration = 1800;

const BATCH_SIZE = 64;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.INGESTION_SECRET}`;

  if (!process.env.INGESTION_SECRET) {
    console.error('INGESTION_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let embedded = 0;

  try {
    for (;;) {
      const batch = await query<{ id: number; text: string }>(
        'SELECT id, text FROM segments WHERE embedding IS NULL ORDER BY id LIMIT $1',
        [BATCH_SIZE]
      );
      if (batch.length === 0) break;

      const embeddings = await generateEmbeddings(batch.map((s) => s.text));
      for (const embedding of embeddings) {
        if (!validateEmbedding(embedding)) {
          throw new Error(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
          );
        }
      }

      await query(
        `UPDATE segments AS s SET embedding = u.embedding::vector
         FROM unnest($1::bigint[], $2::text[]) AS u(id, embedding)
         WHERE s.id = u.id`,
        [batch.map((s) => s.id), embeddings.map(toVector)]
      );

      embedded += batch.length;
      console.log(`[reembed] ${embedded} segments embedded`);
    }

    const remaining = await query<{ count: number }>(
      'SELECT count(*) AS count FROM segments WHERE embedding IS NULL'
    );

    return NextResponse.json({
      success: true,
      embedded,
      remaining: remaining[0]?.count ?? 0,
      dimensions: EMBEDDING_DIMENSIONS,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    console.error('[reembed] failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Progress so far is kept; calling the endpoint again resumes.
    return NextResponse.json({ success: false, embedded, error: message }, { status: 500 });
  }
}
