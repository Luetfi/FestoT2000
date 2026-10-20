// Health check endpoint - verifies all core services
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ServiceStatus {
  name: string;
  status: 'ok' | 'error';
  latency_ms?: number;
  error?: string;
}

export async function GET() {
  const services: ServiceStatus[] = [];

  // Test database connection
  const dbStart = Date.now();
  try {
    await query('SELECT id FROM channels LIMIT 1');

    services.push({
      name: 'database',
      status: 'ok',
      latency_ms: Date.now() - dbStart,
    });
  } catch (err) {
    services.push({
      name: 'database',
      status: 'error',
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // Check environment variables are set (don't call APIs here, just verify config).
  // YOUTUBE_API_KEY is deliberately not checked: it is only needed to ingest new
  // videos, which is optional - search runs without it.
  const envChecks = [
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
