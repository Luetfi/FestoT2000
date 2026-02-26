import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { parseSearchQuery } from '@/lib/search/query-parser';
import { enrichSearchResults, applyBoosts } from '@/lib/search/enrichment';
import { filterByRelevance } from '@/lib/search/relevance-filter';
import { buildSystemPrompt, createChatStream } from '@/lib/openai/chat';
import type { ChatRequest } from '@/types/chat';

const MAX_HISTORY = 10;
const MAX_CONTEXT_SEGMENTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const { message, history = [] } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Trim history to last N messages
    const trimmedHistory = history.slice(-MAX_HISTORY);

    // 1. Generate embedding for user message
    const embedding = await generateEmbedding(message);

    // 2. Parse query for boosting
    const parsed = parseSearchQuery(message);

    // 3. Hybrid search
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
      console.error('Chat search error:', error);
      return new Response(JSON.stringify({ error: 'Search failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Enrich, boost, filter
    const enriched = await enrichSearchResults(rawResults || []);
    const boosted = applyBoosts(enriched, parsed);
    const filtered = filterByRelevance(boosted);
    const topSegments = filtered.slice(0, MAX_CONTEXT_SEGMENTS);

    // 5. Build system prompt with context
    const systemPrompt = buildSystemPrompt(topSegments);

    // 6. Create streaming completion
    const stream = await createChatStream(systemPrompt, trimmedHistory, message);

    // 7. Return SSE stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
