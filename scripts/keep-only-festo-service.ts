import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_SECRET!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  // Find the Festo Service channel
  const { data: festoChannel } = await supabase
    .from('channels')
    .select('id, youtube_id, name')
    .eq('youtube_id', 'UCswhE6URzxILULeMYqOC1Cg')
    .single();

  if (!festoChannel) {
    console.error('Festo Service channel not found!');
    process.exit(1);
  }

  console.log(`Keeping: ${festoChannel.name} (${festoChannel.youtube_id})\n`);

  // Find all videos NOT from Festo Service
  const { data: toDelete } = await supabase
    .from('videos')
    .select('id, title')
    .neq('channel_id', festoChannel.id);

  if (!toDelete || toDelete.length === 0) {
    console.log('No videos to delete.');
    return;
  }

  const ids = toDelete.map((v) => v.id);
  console.log(`Deleting ${toDelete.length} videos from other channels...\n`);

  // Delete in foreign-key-safe order
  const { error: segErr } = await supabase.from('segments').delete().in('video_id', ids);
  if (segErr) console.error('  ✗ segments:', segErr.message);
  else console.log('  ✓ segments deleted');

  const { error: tranErr } = await supabase.from('transcripts').delete().in('video_id', ids);
  if (tranErr) console.error('  ✗ transcripts:', tranErr.message);
  else console.log('  ✓ transcripts deleted');

  const { error: vidErr } = await supabase.from('videos').delete().in('id', ids);
  if (vidErr) console.error('  ✗ videos deleted');
  else console.log('  ✓ videos deleted');

  // Delete all channels except Festo Service
  const { error: chErr } = await supabase.from('channels').delete().neq('id', festoChannel.id);
  if (chErr) console.error('  ✗ channels:', chErr.message);
  else console.log('  ✓ other channels deleted');

  // Verify
  const { count: remaining } = await supabase.from('videos').select('id', { count: 'exact', head: true });
  console.log(`\nDone. ${toDelete.length} videos removed. ${remaining} Festo Service videos remaining.`);
}

main();
