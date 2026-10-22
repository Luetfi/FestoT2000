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
