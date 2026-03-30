import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_SECRET!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const { data: channels } = await supabase.from('channels').select('id, youtube_id, name, official_status');
  console.log('=== CHANNELS ===');
  for (const ch of channels || []) {
    const { count } = await supabase.from('videos').select('id', { count: 'exact', head: true }).eq('channel_id', ch.id);
    console.log(`  [${ch.official_status}] ${ch.name} (${ch.youtube_id}) — ${count} videos`);
  }

  console.log('\n=== ALL VIDEOS ===');
  const { data: videos } = await supabase
    .from('videos')
    .select('id, youtube_id, title, channel:channels(name, official_status)')
    .order('published_at', { ascending: false });
  for (const v of videos || []) {
    const ch = Array.isArray(v.channel) ? v.channel[0] : v.channel;
    console.log(`  [${ch?.official_status}] ${v.title} (${v.youtube_id}) — ${ch?.name}`);
  }
  console.log(`\nTotal: ${videos?.length} videos`);
}

main();
