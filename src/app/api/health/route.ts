// Health check endpoint - verifies all core services
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error';
  latency_ms?: number;
  error?: string;
}

export async function GET() {
  const services: ServiceStatus[] = [];

  // Test Supabase connection
  const supabaseStart = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from('channels')
      .select('id')
      .limit(1);

    if (error) throw error;

    services.push({
      name: 'supabase',
      status: 'ok',
      latency_ms: Date.now() - supabaseStart,
    });
  } catch (err) {
    services.push({
      name: 'supabase',
      status: 'error',
      latency_ms: Date.now() - supabaseStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // Check environment variables are set (don't call APIs here, just verify config)
  const envChecks = [
    { name: 'youtube_api_key', envVar: 'YOUTUBE_API_KEY' },
    { name: 'openai_api_key', envVar: 'OPENAI_API_KEY' },
  ];

  for (const check of envChecks) {
    services.push({
      name: check.name,
      status: process.env[check.envVar] ? 'ok' : 'error',
      error: process.env[check.envVar] ? undefined : `Missing ${check.envVar}`,
    });
  }

  const allOk = services.every((s) => s.status === 'ok');

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    },
    { status: allOk ? 200 : 503 }
  );
}
