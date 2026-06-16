import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { enrichSearchResults } from '@/lib/search/enrichment';
import { filterByRelevance, filterByConfidence, capVideoGroups } from '@/lib/search/relevance-filter';
import { judgeRelevance } from '@/lib/search/relevance-judge';
import { suggestQuery } from '@/lib/search/query-suggester';
import { getOrCreateFeedbackSession, setFeedbackSession } from '@/lib/feedback/session';
import type { SearchResponse } from '@/types/search';

// Below this max confidence (0-100) the result set is considered weak and we
// generate alternative search-term suggestions for the user.
const SUGGESTION_TRIGGER_CONFIDENCE = 65;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const lang: 'de' | 'en' = searchParams.get('lang') === 'en' ? 'en' : 'de';

  if (!query.trim() || query.trim().length < 3) {
    return NextResponse.json<SearchResponse>({ query: query.trim(), results: [], total: 0, suggestions: [] });
  }

  try {
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
      query_text: query,
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
    // Cheap score-based pre-filter; video-group cap is applied after the judge.
    const filtered = filterByRelevance(enriched);

    // LLM judge: content-based confidence (0-100) that each segment answers the query.
    // Falls back to the cosine similarity percentage if the judge is unavailable.
    const confidenceMap = await judgeRelevance(query, filtered);
    const judgeAvailable = confidenceMap.size > 0;
    const withConfidence = filtered.map((r) => ({
      ...r,
      confidence: confidenceMap.get(r.id) ?? Math.round(r.semantic_similarity * 100),
    }));

    // Drop segments the judge does not consider relevant enough to solve the query,
    // sort the most relevant first, then cap to a handful of distinct videos.
    const relevant = filterByConfidence(withConfidence, judgeAvailable);
    relevant.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const results = capVideoGroups(relevant);

    // Weak result set -> suggest more precise search terms. Computed from data we
    // already have (no extra LLM call to *decide*); the suggester call only fires
    // when the query is actually weak, so good queries stay fast.
    const maxConfidence = results.reduce((m, r) => Math.max(m, r.confidence ?? 0), 0);
    const isWeak = results.length === 0 || (judgeAvailable && maxConfidence < SUGGESTION_TRIGGER_CONFIDENCE);
    const suggestions = isWeak
      ? await suggestQuery(query, lang, results.slice(0, 5).map((r) => r.video_title))
      : [];

    // Log this search for coverage-gap analysis (/admin/gaps). The explicit
    // "did this solve your problem?" answer is attached later via queryLogId.
    // A logging failure must never break search, so it's isolated in try/catch.
    const { sessionId, isNew } = getOrCreateFeedbackSession(request);
    let queryLogId: number | undefined;
    try {
      const topConfidence =
        results.length > 0 ? Math.round(maxConfidence) : null;
      const { data: logRow, error: logError } = await supabase
        .from('query_log')
        // @ts-expect-error - insert on loosely-inferred admin client
        .insert({
          query,
          lang,
          result_count: results.length,
          top_confidence: topConfidence,
          was_solved: null,
          session_id: sessionId,
        })
        .select('id')
        .single();
      if (logError) {
        console.error('Query log insert failed:', logError);
      } else {
        queryLogId = (logRow as { id: number } | null)?.id;
      }
    } catch (logErr) {
      console.error('Query log insert threw:', logErr);
    }

    const response: SearchResponse = {
      query,
      results,
      total: results.length,
      suggestions,
      queryLogId,
    };

    const jsonRes = NextResponse.json(response);
    if (isNew) setFeedbackSession(jsonRes, sessionId);
    return jsonRes;
  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Search failed: ${message}` }, { status: 500 });
  }
}
