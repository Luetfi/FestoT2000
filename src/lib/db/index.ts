// PostgreSQL access - server-only
// Direct connection via node-postgres; replaces the former Supabase client.
import 'server-only';
import { readFileSync } from 'node:fs';
import { Pool, types, type PoolConfig, type QueryResultRow } from 'pg';

// bigint (int8) -> number. Ids and count(*) results stay far below 2^53, and
// the callers have always treated them as numbers.
types.setTypeParser(20, (value) => parseInt(value, 10));
// numeric -> number (e.g. round(avg(...)) in the query_gaps view)
types.setTypeParser(1700, (value) => parseFloat(value));

/**
 * TLS for the database connection, controlled by environment:
 *   DATABASE_SSL_CA  path to a CA bundle -> encrypted and certificate verified
 *                    (Amazon RDS: global-bundle.pem)
 *   DATABASE_SSL     'require' -> encrypted without certificate verification
 *   neither          plain connection (local development)
 */
function sslConfig(): PoolConfig['ssl'] {
  const caPath = process.env.DATABASE_SSL_CA;
  if (caPath) return { ca: readFileSync(caPath, 'utf8') };
  if (process.env.DATABASE_SSL === 'require') return { rejectUnauthorized: false };
  return undefined;
}

// Cached on globalThis so Next.js hot reloads in development reuse one pool
// instead of opening a new set of connections per reload.
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

function getPool(): Pool {
  if (globalForDb.__dbPool) return globalForDb.__dbPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable');
  }

  const pool = new Pool({ connectionString, ssl: sslConfig(), max: 10 });
  // An idle client losing its connection must not crash the process.
  pool.on('error', (err) => console.error('Idle database client error:', err));
  globalForDb.__dbPool = pool;
  return pool;
}

/** Run a parameterized query and return all rows. */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** Run a parameterized query and return the first row, or null. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Serialize an embedding into pgvector's text form; cast with ::vector in SQL. */
export function toVector(values: number[]): string {
  return `[${values.join(',')}]`;
}
