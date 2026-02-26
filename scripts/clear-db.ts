import { createClient } from '@supabase/supabase-js';

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

  // Delete in foreign-key-safe order
  const tables = ['segments', 'transcripts', 'videos', 'channels'];

  console.log('Clearing all tables...\n');

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', 0);
    if (error) {
      console.error(`  ✗ ${table}: ${error.message}`);
    } else {
      console.log(`  ✓ ${table} cleared`);
    }
  }

  console.log('\nDone.');
}

main();
