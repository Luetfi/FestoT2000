// Anonymous feedback session: a signed-cookie-free random id we attach to
// feedback rows so we can dedupe votes and match a "did your search get solved?"
// answer back to its query_log row — without identifying the user. Shared by the
// feedback routes and the search route (which logs every query).
import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/auth/session';

export const FB_COOKIE_NAME = 'fb_sid';

// Read the feedback session id from the request, creating a fresh one if absent.
// `isNew` tells the caller to persist it via setFeedbackSession on the response.
export function getOrCreateFeedbackSession(request: NextRequest): {
  sessionId: string;
  isNew: boolean;
} {
  const existing = request.cookies.get(FB_COOKIE_NAME)?.value;
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: crypto.randomUUID(), isNew: true };
}

export function setFeedbackSession(response: NextResponse, sessionId: string): void {
  response.cookies.set(FB_COOKIE_NAME, sessionId, cookieOptions());
}
