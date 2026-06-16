import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openai/embeddings';
import { enrichSearchResults } from '@/lib/search/enrichment';
import { filterByRelevance } from '@/lib/search/relevance-filter';
import { condenseQuery } from '@/lib/search/query-condenser';
import { buildSystemPrompt, createChatStream } from '@/lib/openai/chat';
import type { ChatRequest } from '@/types/chat';

const MAX_HISTORY = 10;
const MAX_CONTEXT_SEGMENTS = 8;

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

    // 1. Condense follow-up messages into a standalone search query, then embed
    const searchQuery = await condenseQuery(message, trimmedHistory);
    const embedding = await generateEmbedding(searchQuery);

    // 2. Hybrid search
    const supabase = getSupabaseAdmin();
    // @ts-expect-error - RPC function types may not be fully inferred
    const { data: rawResults, error } = await supabase.rpc('hybrid_search_segments', {
      query_text: searchQuery,
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

    // 3. Enrich and filter
    const enriched = await enrichSearchResults(rawResults || []);
    const filtered = filterByRelevance(enriched);
    const topSegments = filtered.slice(0, MAX_CONTEXT_SEGMENTS);

    // 4. Build system prompt with context
    const systemPrompt = buildSystemPrompt(topSegments);

    // 5. Create streaming completion
    const stream = await createChatStream(systemPrompt, trimmedHistory, message);

    // 6. Return SSE stream
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
