import 'server-only';
import { NextRequest } from 'next/server';
import { generateChatTitle } from '@/lib/openai/title';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { question?: string; answer?: string };
    const question = body.question?.trim();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const title = await generateChatTitle(question, body.answer ?? '');

    return new Response(JSON.stringify({ title }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Chat title API error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
