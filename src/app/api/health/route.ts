// Health check endpoint - verifies all core services
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { rateLimitMiddleware } from '@/lib/rate-limit';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error';
  latency_ms?: number;
  error?: string;
}

export async function GET(request: Request) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) return rateLimitResponse;

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

  // Test rate limiter
  const rateLimitConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  services.push({
    name: 'rate_limiter',
    status: rateLimitConfigured ? 'ok' : 'error',
    error: rateLimitConfigured ? undefined : 'Not configured (missing Upstash env vars)',
  });

  // Check environment variables are set (don't call APIs here, just verify config)
  const envChecks = [
    { name: 'youtube_api_key', envVar: 'YOUTUBE_API_KEY' },
    { name: 'openai_api_key', envVar: 'OPENAI_API_KEY' },
    { name: 'upstash_redis', envVar: 'UPSTASH_REDIS_REST_URL' },
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
