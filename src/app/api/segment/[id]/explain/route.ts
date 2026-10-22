import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery, queryOne } from '@/lib/db';
import { generateExplanation } from '@/lib/ai/summaries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const segmentId = parseInt(id, 10);
  if (isNaN(segmentId)) {
    return NextResponse.json({ error: 'Invalid segment ID' }, { status: 400 });
  }

  const query = request.nextUrl.searchParams.get('q') || undefined;

  try {
    const segment = await queryOne<{ id: number; text: string; explanation: string | null }>(
      'SELECT id, text, explanation FROM segments WHERE id = $1',
      [segmentId]
    );

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // When a search query is provided, always generate a fresh query-specific answer (no caching)
    if (query) {
      const explanation = await generateExplanation(segment.text, query);
      return NextResponse.json({ explanation });
    }

    // No query: use cached generic explanation if available
    if (segment.explanation) {
      return NextResponse.json({ explanation: segment.explanation });
    }

    // Generate generic explanation on-demand
    const explanation = await generateExplanation(segment.text);

    // Cache generic explanation in DB
    await dbQuery('UPDATE segments SET explanation = $2 WHERE id = $1', [segmentId, explanation]);

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('Explanation generation failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Explanation failed: ${message}` },
      { status: 500 }
    );
  }
}
