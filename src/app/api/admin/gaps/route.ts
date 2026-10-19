// Coverage-gap queue: search queries that stayed unanswered. Reads the query_gaps
// view (queries users marked unsolved, that returned zero results, or never broke
// a weak confidence ceiling) so an editor can decide which videos to ingest next.
// Protected by the session cookie via middleware, like /api/admin/review.
import 'server-only';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { QueryGap } from '@/lib/db/types';

export type GapRow = QueryGap;

export async function GET() {
  let data: GapRow[];
  try {
    data = await query<GapRow>('SELECT * FROM query_gaps LIMIT 200');
  } catch (error) {
    console.error('Gaps fetch failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Rank by how badly the query is uncovered: explicit "unsolved" answers and
  // zero-result searches weigh most, then overall search volume as a tiebreaker.
  const gaps = data
    .slice()
    .sort((a, b) => {
      const aScore = a.unsolved_count + a.zero_result_count;
      const bScore = b.unsolved_count + b.zero_result_count;
      if (bScore !== aScore) return bScore - aScore;
      return b.search_count - a.search_count;
    });

  return NextResponse.json({ gaps });
}
