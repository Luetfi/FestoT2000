import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery, queryOne, toVector } from '@/lib/db';
import type { HybridSearchResult } from '@/lib/db/types';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { enrichSearchResults } from '@/lib/search/enrichment';
import { filterByRelevance, filterByConfidence, capVideoGroups } from '@/lib/search/relevance-filter';
import { judgeRelevance } from '@/lib/search/relevance-judge';
import { pickJumpSegments, applyJumpSegments } from '@/lib/search/segment-picker';
import { translateQuery } from '@/lib/search/query-translator';
import { suggestQuery } from '@/lib/search/query-suggester';
import { resolveSearchConfig } from '@/lib/search/search-config';
import { getOrCreateFeedbackSession, setFeedbackSession } from '@/lib/feedback/session';
import type { SearchResponse } from '@/types/search';

// Below this max confidence (0-100) the result set is considered weak and we
// generate alternative search-term suggestions for the user.
const SUGGESTION_TRIGGER_CONFIDENCE = 65;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const lang: 'de' | 'en' = searchParams.get('lang') === 'en' ? 'en' : 'de';

  // Messbetrieb: Vergleichsmessungen laufen ueber diese Route, damit sie das
  // ausgelieferte System treffen und nicht einen Nachbau. Dabei entfaellt die
  // Betriebsprotokollierung, und einzelne Suchstufen lassen sich gezielt
  // zuschalten (siehe search-config.ts).
  const isEval = searchParams.get('eval') === '1';
  const config = resolveSearchConfig(searchParams);

  if (!query.trim() || query.trim().length < 3) {
    return NextResponse.json<SearchResponse>({ query: query.trim(), results: [], total: 0, suggestions: [] });
  }

  try {
    // Zweisprachige Anfrage: Die Anfragen sind deutsch, rund drei Viertel der
    // Transkripte englisch. Uebersetzung und Einbettungen laufen parallel, damit
    // die zusaetzliche Sprache keine zusaetzliche Wartezeit kostet.
    let embedding: number[];
    let queryAlt: string | null = null;
    let embeddingAlt: number[] | null = null;
    try {
      if (config.bilingualQuery) {
        queryAlt = await translateQuery(query);
        // Eine Uebersetzung, die der Anfrage entspricht, braucht keine zweite
        // Einbettung - sie wuerde denselben Rang liefern.
        const needsAlt = queryAlt !== null && queryAlt.trim() !== query.trim();
        const [primary, alt] = await Promise.all([
          generateEmbedding(query),
          needsAlt ? generateEmbedding(queryAlt as string) : Promise.resolve(null),
        ]);
        embedding = primary;
        embeddingAlt = alt;
        if (!needsAlt) queryAlt = null;
      } else {
        embedding = await generateEmbedding(query);
      }
    } catch (embeddingError) {
      console.error('Embedding generation failed:', embeddingError);
      const message = embeddingError instanceof Error ? embeddingError.message : 'Unknown error';
      return NextResponse.json(
        { error: `Embedding failed: ${message}` },
        { status: 500 }
      );
    }

    let rawResults: HybridSearchResult[];
    try {
      rawResults = await dbQuery<HybridSearchResult>(
        `SELECT * FROM hybrid_search_segments(
           query_text => $1,
           query_embedding => $2::vector,
           match_count => $3,
           full_text_weight => $4,
           semantic_weight => $5,
           rrf_k => $6,
           query_text_alt => $7,
           query_embedding_alt => $8::vector,
           fts_mode => $9
         )`,
        [
          query,
          toVector(embedding),
          config.matchCount,
          config.fullTextWeight,
          config.semanticWeight,
          config.rrfK,
          queryAlt,
          embeddingAlt ? toVector(embeddingAlt) : null,
          config.ftsMode,
        ]
      );
    } catch (error) {
      console.error('Hybrid search error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Database search failed: ${message}` },
        { status: 500 }
      );
    }

    const enriched = await enrichSearchResults(rawResults);
    // Cheap score-based pre-filter; video-group cap is applied after the judge.
    const filtered = filterByRelevance(enriched, config.minSemanticSimilarity);

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
    const relevant = filterByConfidence(withConfidence, judgeAvailable, config.minConfidence);
    relevant.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const capped = capVideoGroups(relevant, config.maxVideoGroups);

    // Sprungstelle: Welches Video gefunden wird, hat der titelbewusste Judge
    // oben entschieden. Wo im Video eingestiegen wird, entscheidet ein
    // titelfreier Durchgang ueber ALLE Segmente dieser Videos - sonst waehlt die
    // Titelnaehe die Stelle, und das ist regelmaessig das Anfangssegment.
    // Faellt der Picker aus, bleibt es beim bisherigen Verhalten.
    let results = capped;
    if (config.segmentPicker && capped.length > 0) {
      const videoIds = [...new Set(capped.map((r) => r.video_id))];
      const jumps = await pickJumpSegments(query, embedding, videoIds);
      results = applyJumpSegments(capped, jumps);
    }

    // Weak result set -> suggest more precise search terms. Computed from data we
    // already have (no extra LLM call to *decide*); the suggester call only fires
    // when the query is actually weak, so good queries stay fast.
    const maxConfidence = results.reduce((m, r) => Math.max(m, r.confidence ?? 0), 0);
    const isWeak = results.length === 0 || (judgeAvailable && maxConfidence < SUGGESTION_TRIGGER_CONFIDENCE);
    const suggestions =
      isWeak && !isEval
        ? await suggestQuery(query, lang, results.slice(0, 5).map((r) => r.video_title))
        : [];

    // Log this search for coverage-gap analysis (/admin/gaps). The explicit
    // "did this solve your problem?" answer is attached later via queryLogId.
    // A logging failure must never break search, so it's isolated in try/catch.
    // Messlaeufe werden nicht protokolliert: Sie wuerden die Auswertung der
    // echten Nutzungsanfragen in /admin/gaps verfaelschen.
    const { sessionId, isNew } = getOrCreateFeedbackSession(request);
    let queryLogId: number | undefined;
    if (!isEval) {
      try {
        const topConfidence =
          results.length > 0 ? Math.round(maxConfidence) : null;
        const logRow = await queryOne<{ id: number }>(
          `INSERT INTO query_log (query, lang, result_count, top_confidence, was_solved, session_id)
           VALUES ($1, $2, $3, $4, NULL, $5)
           RETURNING id`,
          [query, lang, results.length, topConfidence, sessionId]
        );
        queryLogId = logRow?.id;
      } catch (logErr) {
        console.error('Query log insert threw:', logErr);
      }
    }

    const response: SearchResponse = {
      query,
      results,
      // Eingefuegte Sprungstellen sind kein eigener Treffer (siehe segment-picker.ts).
      total: results.filter((r) => !r.injected).length,
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
