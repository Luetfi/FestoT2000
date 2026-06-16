/**
 * One-off cleanup: mark every 'approved' video that has NO segments as 'rejected'.
 * These are videos that were upserted but never produced searchable content
 * (no DE/EN transcript or empty transcript). They never appear in search, but
 * leaving them 'approved' inflates counts and clutters /admin/review.
 *
 * Going forward the ingest pipeline marks such videos 'rejected' directly, so
 * this only needs to run once to clean historical data.
 *
 * Usage: npx tsx --env-file=.env.local scripts/cleanup-empty-videos.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function pagedIds(table: string, column: string, filter?: (q: any) => any): Promise<number[]> {
  const ids: number[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(column).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as Record<string, number>[];
    for (const r of rows) ids.push(r[column]);
    if (rows.length < pageSize) break;
  }
  return ids;
}

async function main() {
  console.log('Collecting video_ids that have segments...');
  const withSegments = new Set(await pagedIds('segments', 'video_id'));
  console.log(`  ${withSegments.size} videos have at least one segment.`);

  console.log('Collecting approved video ids...');
  const approved = await pagedIds('videos', 'id', (q) => q.eq('review_status', 'approved'));
  console.log(`  ${approved.length} approved videos.`);

  const empty = approved.filter((id) => !withSegments.has(id));
  console.log(`  ${empty.length} approved videos have NO segments → marking rejected.`);

  if (!empty.length) { console.log('Nothing to clean up.'); return; }

  let updated = 0;
  const batchSize = 200;
  for (let i = 0; i < empty.length; i += batchSize) {
    const batch = empty.slice(i, i + batchSize);
    const { error } = await supabase
      .from('videos')
      .update({ review_status: 'rejected', relevance_reason: 'Kein nutzbares Transkript' } as any)
      .in('id', batch);
    if (error) throw error;
    updated += batch.length;
    console.log(`  updated ${updated}/${empty.length}`);
  }

  console.log(`\nDone. ${updated} empty videos marked rejected.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
