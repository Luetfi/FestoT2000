// Per-video feedback (thumbs up/down). Anonymous: identified only by the fb_sid
// cookie, which also dedupes votes via the uq_video_feedback_dedup unique index.
// Writes go through the service-role client, exactly like the search/admin routes.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getOrCreateFeedbackSession, setFeedbackSession } from '@/lib/feedback/session';
import type { FeedbackType } from '@/lib/supabase/types';

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

  const { error } = await getSupabaseAdmin()
    .from('video_feedback')
    // @ts-expect-error - upsert on loosely-inferred admin client
    .upsert(
      {
        video_id: videoId,
        segment_id: typeof segmentId === 'number' ? segmentId : null,
        feedback_type: feedbackType,
        is_positive: isPositive,
        query: typeof query === 'string' ? query.trim() : '',
        reason: cleanReason,
        lang: typeof lang === 'string' ? lang : null,
        session_id: sessionId,
      },
      { onConflict: 'session_id,video_id,feedback_type,query' }
    );

  if (error) {
    console.error('Feedback insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  if (isNew) setFeedbackSession(res, sessionId);
  return res;
}
