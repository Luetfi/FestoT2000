import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { parseSearchQuery } from '@/lib/search';
import { enrichSearchResults, applyBoosts } from '@/lib/search/enrichment';
import { filterByRelevance } from '@/lib/search/relevance-filter';
import type { SearchResponse } from '@/types/search';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';

  if (!query.trim() || query.trim().length < 3) {
    return NextResponse.json<SearchResponse>({ query: query.trim(), results: [], total: 0 });
  }

  try {
    const parsed = parseSearchQuery(query);

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

    const supabase = getSupabaseAdmin();
    // @ts-expect-error - RPC function types may not be fully inferred
    const { data: rawResults, error } = await supabase.rpc('hybrid_search_segments', {
      query_text: parsed.enhancedQuery,
      query_embedding: embedding,
      match_count: 30,
      full_text_weight: 1.0,
      semantic_weight: 1.5,
      rrf_k: 50,
    });

    if (error) {
      console.error('Hybrid search error:', error);
      return NextResponse.json(
        { error: `Database search failed: ${error.message}` },
        { status: 500 }
      );
    }

    const enriched = await enrichSearchResults(rawResults || []);
    const boosted = applyBoosts(enriched, parsed);
    const filtered = filterByRelevance(boosted);

    const response: SearchResponse = {
      query,
      results: filtered,
      total: filtered.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Search failed: ${message}` }, { status: 500 });
  }
}
