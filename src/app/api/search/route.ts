import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openai/embeddings';
import {
  parseSearchQuery,
  generateCacheKey,
  getCachedResults,
  setCachedResults,
} from '@/lib/search';
import { enrichSearchResults, applyBoosts } from '@/lib/search/enrichment';
import type { SearchResponse, SearchResultSegment } from '@/types/search';

export async function GET(request: NextRequest) {
  // 1. Parse query params
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const language = (searchParams.get('lang') as 'de' | 'en') || 'de';
  const source = (searchParams.get('source') as 'all' | 'official' | 'community') || 'all';

  // Empty query returns empty results
  if (!query.trim()) {
    return NextResponse.json<SearchResponse>({ query: '', results: [], total: 0 });
  }

  // 3. Check cache first
  const cacheKey = generateCacheKey({ query, language, source });
  const cached = await getCachedResults(cacheKey);
  if (cached) {
    // Apply source filter to cached results
    const filtered = filterBySource(cached.results, source);
    return NextResponse.json<SearchResponse>({
      query: cached.query,
      results: filtered,
      total: filtered.length,
    });
  }

  try {
    // 4. Parse query for error codes/keywords
    const parsed = parseSearchQuery(query);

    // 5. Generate embedding for semantic search
    let embedding: number[];
    try {
      embedding = await generateEmbedding(query);
    } catch (embeddingError) {
      console.error('Embedding generation failed:', embeddingError);
      const message = embeddingError instanceof Error ? embeddingError.message : 'Unknown error';
      return NextResponse.json(
        { error: `Embedding failed: ${message}` },
        { status: 500 }
      );
    }

    // 6. Execute hybrid search
    const supabase = getSupabaseAdmin();
    // @ts-expect-error - RPC function types may not be fully inferred
    const { data: rawResults, error } = await supabase.rpc('hybrid_search_segments', {
      query_text: parsed.enhancedQuery,
      query_embedding: embedding,
      match_count: 50, // Fetch more for filtering
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50,
    });

    if (error) {
      console.error('Hybrid search error:', error);
      return NextResponse.json(
        { error: `Database search failed: ${error.message}` },
        { status: 500 }
      );
    }

    // 7. Enrich results with video/channel data
    const enriched = await enrichSearchResults(rawResults || []);

    // 8. Apply boosts for error codes and keywords
    const boosted = applyBoosts(enriched, parsed);

    // 9. Apply source filter
    const filtered = filterBySource(boosted, source);

    // 10. Store in cache - cache unfiltered results for reuse
    await setCachedResults(cacheKey, query, language, source, boosted);

    // 11. Return response (should complete in <3s for warm cache)
    const response: SearchResponse = {
      query,
      results: filtered.slice(0, 20), // Return top 20
      total: filtered.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Search failed: ${message}` }, { status: 500 });
  }
}

// Helper to filter results by official status
function filterBySource(
  results: SearchResultSegment[],
  source: 'all' | 'official' | 'community'
): SearchResultSegment[] {
  if (source === 'all') return results;
  return results.filter((r) => r.channel_official_status === source);
}
