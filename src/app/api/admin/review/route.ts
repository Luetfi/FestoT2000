// Admin management view for community videos.
// Protected by the session cookie via middleware (not in SELF_AUTHED_PREFIXES),
// so only logged-in users reach it. Community videos go live automatically (the
// strict ingest gate is the quality bar); this GET lists the live community
// videos so a human can remove a bad one. POST flips review_status.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export interface ReviewVideo {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  content_type: string | null;
  channel_name: string | null;
  segment_count: number;
  positive_count: number;
  negative_count: number;
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Only live (approved) videos from community channels — the videos a reviewer
  // might want to pull back out of search. !inner so the channel filter narrows
  // the parent rows.
  const { data, error } = await supabase
    .from('videos')
    .select(
      'id, youtube_id, title, thumbnail_url, duration_seconds, relevance_score, relevance_reason, content_type, channels!inner(name, official_status), segments(count)'
    )
    .eq('review_status', 'approved')
    .eq('channels.official_status', 'community')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Review queue fetch failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface RawReviewRow {
    id: number;
    youtube_id: string;
    title: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    relevance_score: number | null;
    relevance_reason: string | null;
    content_type: string | null;
    channels: { name: string; official_status: string } | null;
    segments: { count: number }[] | null;
  }

  const rows = (data ?? []) as unknown as RawReviewRow[];

  // Pull user-feedback totals for these videos and index them by video_id.
  const ids = rows.map((v) => v.id);
  const feedbackByVideo = new Map<number, { positive: number; negative: number }>();
  if (ids.length > 0) {
    const { data: stats, error: statsError } = await supabase
      .from('video_feedback_stats')
      .select('video_id, positive_count, negative_count')
      .in('video_id', ids);
    if (statsError) {
      console.error('Feedback stats fetch failed:', statsError);
    } else {
      for (const s of (stats ?? []) as { video_id: number; positive_count: number; negative_count: number }[]) {
        feedbackByVideo.set(s.video_id, {
          positive: Number(s.positive_count) || 0,
          negative: Number(s.negative_count) || 0,
        });
      }
    }
  }

  const videos: ReviewVideo[] = rows.map((v) => ({
    id: v.id,
    youtube_id: v.youtube_id,
    title: v.title,
    thumbnail_url: v.thumbnail_url,
    duration_seconds: v.duration_seconds,
    relevance_score: v.relevance_score,
    relevance_reason: v.relevance_reason,
    content_type: v.content_type,
    channel_name: v.channels?.name ?? null,
    segment_count: v.segments?.[0]?.count ?? 0,
    positive_count: feedbackByVideo.get(v.id)?.positive ?? 0,
    negative_count: feedbackByVideo.get(v.id)?.negative ?? 0,
  }));

  // Surface the videos users disliked most first — they are the likeliest to pull.
  videos.sort((a, b) => b.negative_count - a.negative_count);

  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  let body: { videoId?: number; action?: 'approve' | 'reject' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { videoId, action } = body;
  if (typeof videoId !== 'number' || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json(
      { error: 'Expected { videoId: number, action: "approve" | "reject" }' },
      { status: 400 }
    );
  }

  const review_status = action === 'approve' ? 'approved' : 'rejected';

  const { error } = await getSupabaseAdmin()
    .from('videos')
    // @ts-expect-error - review_status update on loosely-inferred admin client
    .update({ review_status })
    .eq('id', videoId);

  if (error) {
    console.error('Review update failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, videoId, review_status });
}
