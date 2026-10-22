// Per-video feedback (thumbs up/down). Anonymous: identified only by the fb_sid
// cookie, which also dedupes votes via the uq_video_feedback_dedup unique index.
// Writes go through the service-role client, exactly like the search/admin routes.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';
import { getOrCreateFeedbackSession, setFeedbackSession } from '@/lib/feedback/session';
import type { FeedbackType } from '@/lib/db/types';

const FEEDBACK_TYPES: FeedbackType[] = ['search_result', 'video'];
const REASONS = ['not_relevant', 'wrong_topic', 'too_basic', 'bad_quality', 'other'];

export async function POST(request: NextRequest) {
  let body: {
    videoId?: number;
    segmentId?: number;
    feedbackType?: FeedbackType;
    isPositive?: boolean;
    query?: string;
    reason?: string;
    lang?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { videoId, segmentId, feedbackType, isPositive, query, reason, lang } = body;

  if (
    typeof videoId !== 'number' ||
    typeof isPositive !== 'boolean' ||
    !feedbackType ||
    !FEEDBACK_TYPES.includes(feedbackType)
  ) {
    return NextResponse.json(
      { error: 'Expected { videoId:number, feedbackType, isPositive:boolean }' },
      { status: 400 }
    );
  }

  // A reason only makes sense for negative feedback, and only from the known set.
  const cleanReason =
    !isPositive && typeof reason === 'string' && REASONS.includes(reason) ? reason : null;

  const { sessionId, isNew } = getOrCreateFeedbackSession(request);

  try {
    await dbQuery(
      `INSERT INTO video_feedback
         (video_id, segment_id, feedback_type, is_positive, query, reason, lang, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id, video_id, feedback_type, query) DO UPDATE SET
         segment_id = EXCLUDED.segment_id,
         is_positive = EXCLUDED.is_positive,
         reason = EXCLUDED.reason,
         lang = EXCLUDED.lang`,
      [
        videoId,
        typeof segmentId === 'number' ? segmentId : null,
        feedbackType,
        isPositive,
        typeof query === 'string' ? query.trim() : '',
        cleanReason,
        typeof lang === 'string' ? lang : null,
        sessionId,
      ]
    );
  } catch (error) {
    console.error('Feedback insert failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  if (isNew) setFeedbackSession(res, sessionId);
  return res;
}
