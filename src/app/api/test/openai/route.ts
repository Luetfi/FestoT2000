// OpenAI embeddings integration test
import { NextResponse } from 'next/server';
import { generateEmbedding, EMBEDDING_DIMENSIONS, validateEmbedding } from '@/lib/openai/embeddings';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  // Allow custom text via query param for testing
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text') || 'Festo pneumatische Zylinder Fehlersuche';

  try {
    const startTime = Date.now();
    const embedding = await generateEmbedding(text);
    const latencyMs = Date.now() - startTime;

    const isValid = validateEmbedding(embedding);

    return NextResponse.json({
      status: 'ok',
      latency_ms: latencyMs,
      embedding: {
        dimensions: embedding.length,
        expected_dimensions: EMBEDDING_DIMENSIONS,
        valid: isValid,
        // Return first 5 values as sample (don't expose full embedding)
        sample: embedding.slice(0, 5),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
