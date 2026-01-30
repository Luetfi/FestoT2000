import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { SearchResultSegment } from '@/types/search';
import type { SearchParams, CachedSearchResult } from './types';

/**
 * Generate deterministic SHA256 hash for cache key
 * Normalizes query parameters for consistent caching
 */
export function generateCacheKey(params: SearchParams): string {
  const normalized = {
    q: params.query.toLowerCase().trim(),
    l: params.language,
    s: params.source,
  };
  const input = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Retrieve cached search results if not expired
 * Returns null if cache miss or expired
 */
export async function getCachedResults(
  queryHash: string
): Promise<CachedSearchResult | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('search_cache')
    .select('results')
    .eq('query_hash', queryHash)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  // @ts-expect-error - Supabase types don't infer correctly with Proxy pattern
  return data.results as CachedSearchResult;
}

/**
 * Store search results in cache with 7-day TTL
 * Uses upsert to refresh cache if query hash already exists
 */
export async function setCachedResults(
  queryHash: string,
  queryText: string,
  language: string,
  source: string,
  results: SearchResultSegment[]
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const cachedResult: CachedSearchResult = {
    query: queryText,
    results,
    total: results.length,
    cachedAt: new Date().toISOString(),
  };

  // @ts-expect-error - Supabase types don't infer correctly with Proxy pattern
  await supabase.from('search_cache').upsert({
    query_hash: queryHash,
    query_text: queryText,
    language,
    filters: { source },
    results: cachedResult,
    // expires_at defaults to NOW() + 7 days via DB schema default
  });
}
