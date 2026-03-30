import { createClient } from '@supabase/supabase-js';

const COMMUNITY_VIDEO_IDS = [
  '_qNMpBMth8M', '2CxYWda4OzY', '5EjWYjMPVh0', '6sct2K-l8Dk', '73KjKu2_WH0',
  '88RxsPRrulw', '8tU8iB6D1lE', '8-zr86wbWgw', '9ECpbMYYTe4', 'ajLRtRs92lY',
  'AlaHP5TTsD4', 'andW38zxavU', 'AuYCtVOuP5k', 'bgRfz5uxOL4', 'c0El15iMr3s',
  'c5OtKlNRxNE', 'dai-xeIIO18', 'DxftV8vh2gk', 'dXjdZWDO2-E', 'EFeKd-lFL-A',
  'FDVxtAKTy9U', 'fILOUTwiEGw', 'fP_tNYW6XGQ', 'Fq3quAsiGJs', 'FQPy7gfInoA',
  'GQkQfsUNcH4', 'HbcpN6Mzo8I', 'hJPrh-qF4hM', 'i-q5nKyfhvE', 'k_T5c27EhEw',
  'K7wsRW8e3wU', 'kjDoKjm-vpc', 'llwGnfrEPaI', 'LwXLMtmWh9g', 'm0jHjJ131x4',
  'MoFnq-rYkyQ', 'OA5Qt3Co1Ok', 'pWK2JhaGSFI', 'Q3efUItPWKE', 'QA__3LXq1EY',
  'qrWxQpD2q4k', 'TKy_tZEcopI', 'W8lqzzx13Rg', 'wGjJfqNJzjI', 'YlcH9vVfUuk',
  'YyV07-Zd8VQ', 'zc_Z4w5z_JA',
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_SECRET');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Find video DB IDs by youtube_id
  const { data: videos, error: fetchError } = await supabase
    .from('videos')
    .select('id, youtube_id')
    .in('youtube_id', COMMUNITY_VIDEO_IDS);

  if (fetchError) {
    console.error('Error fetching videos:', fetchError.message);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log('No community videos found in database. Nothing to delete.');
    return;
  }

  const videoDbIds = videos.map((v) => v.id);
  console.log(`Found ${videos.length} community videos to remove.\n`);

  // Delete in foreign-key-safe order
  const { error: segErr } = await supabase.from('segments').delete().in('video_id', videoDbIds);
  if (segErr) console.error('  ✗ segments:', segErr.message);
  else console.log('  ✓ segments deleted');

  const { error: tranErr } = await supabase.from('transcripts').delete().in('video_id', videoDbIds);
  if (tranErr) console.error('  ✗ transcripts:', tranErr.message);
  else console.log('  ✓ transcripts deleted');

  const { error: vidErr } = await supabase.from('videos').delete().in('id', videoDbIds);
  if (vidErr) console.error('  ✗ videos:', vidErr.message);
  else console.log('  ✓ videos deleted');

  // Clean up orphaned channels (channels with no remaining videos)
  const { data: orphanedChannels } = await supabase
    .from('channels')
    .select('id, youtube_id, videos(id)')
    .eq('videos.id', null as any);

  // Alternative: find channels that have zero videos
  const { data: allChannels } = await supabase.from('channels').select('id, youtube_id');
  if (allChannels) {
    for (const ch of allChannels) {
      const { data: chVideos } = await supabase.from('videos').select('id').eq('channel_id', ch.id);
      if (!chVideos || chVideos.length === 0) {
        const { error } = await supabase.from('channels').delete().eq('id', ch.id);
        if (!error) console.log(`  ✓ orphaned channel ${ch.youtube_id} deleted`);
      }
    }
  }

  console.log(`\nDone. Removed ${videos.length} community videos.`);
}

main();
