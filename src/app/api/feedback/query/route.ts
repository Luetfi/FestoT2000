// Explicit "did your search get solved?" answer. Updates the was_solved flag on
// the query_log row the search API created, matched by id AND the caller's fb_sid
// so one visitor can't overwrite another's answer.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { FB_COOKIE_NAME } from '@/lib/feedback/session';

export async function PATCH(request: NextRequest) {
  let body: { queryLogId?: number; wasSolved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { queryLogId, wasSolved } = body;
  if (typeof queryLogId !== 'number' || typeof wasSolved !== 'boolean') {
    return NextResponse.json(
      { error: 'Expected { queryLogId:number, wasSolved:boolean }' },
      { status: 400 }
    );
  }

  const sessionId = request.cookies.get(FB_COOKIE_NAME)?.value;
  if (!sessionId) {
    // No session cookie means this client never logged a search this session.
    return NextResponse.json({ error: 'No feedback session' }, { status: 400 });
  }

  try {
    await query('UPDATE query_log SET was_solved = $3 WHERE id = $1 AND session_id = $2', [
      queryLogId,
      sessionId,
      wasSolved,
    ]);
  } catch (error) {
    console.error('Query outcome update failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
