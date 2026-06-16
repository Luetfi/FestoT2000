// Coverage-gap queue: search queries that stayed unanswered. Reads the query_gaps
// view (queries users marked unsolved, that returned zero results, or never broke
// a weak confidence ceiling) so an editor can decide which videos to ingest next.
// Protected by the session cookie via middleware, like /api/admin/review.
import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { QueryGap } from '@/lib/supabase/types';

export type GapRow = QueryGap;

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from('query_gaps')
    .select('*')
    .limit(200);

  if (error) {
    console.error('Gaps fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Rank by how badly the query is uncovered: explicit "unsolved" answers and
  // zero-result searches weigh most, then overall search volume as a tiebreaker.
  const gaps = ((data ?? []) as GapRow[])
    .slice()
    .sort((a, b) => {
      const aScore = a.unsolved_count + a.zero_result_count;
      const bScore = b.unsolved_count + b.zero_result_count;
      if (bScore !== aScore) return bScore - aScore;
      return b.search_count - a.search_count;
    });

  return NextResponse.json({ gaps });
}
