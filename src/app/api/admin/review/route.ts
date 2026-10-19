// Admin management view for community videos.
// Protected by the session cookie via middleware (not in SELF_AUTHED_PREFIXES),
// so only logged-in users reach it. Community videos go live automatically (the
// strict ingest gate is the quality bar); this GET lists the live community
// videos so a human can remove a bad one. POST flips review_status.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
  // Only live (approved) videos from community channels — the videos a reviewer
  // might want to pull back out of search.
  interface RawReviewRow {
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
  }

  let rows: RawReviewRow[];
  try {
    rows = await query<RawReviewRow>(
      `SELECT v.id, v.youtube_id, v.title, v.thumbnail_url, v.duration_seconds,
              v.relevance_score, v.relevance_reason, v.content_type,
              c.name AS channel_name,
              (SELECT count(*) FROM segments s WHERE s.video_id = v.id) AS segment_count
       FROM videos v
       JOIN channels c ON c.id = v.channel_id
       WHERE v.review_status = 'approved'
         AND c.official_status = 'community'
       ORDER BY v.created_at DESC
       LIMIT 200`
    );
  } catch (error) {
    console.error('Review queue fetch failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Pull user-feedback totals for these videos and index them by video_id.
  const ids = rows.map((v) => v.id);
  const feedbackByVideo = new Map<number, { positive: number; negative: number }>();
  if (ids.length > 0) {
    try {
      const stats = await query<{ video_id: number; positive_count: number; negative_count: number }>(
        `SELECT video_id, positive_count, negative_count
         FROM video_feedback_stats
         WHERE video_id = ANY($1::bigint[])`,
        [ids]
      );
      for (const s of stats) {
        feedbackByVideo.set(s.video_id, {
          positive: Number(s.positive_count) || 0,
          negative: Number(s.negative_count) || 0,
        });
      }
    } catch (statsError) {
      console.error('Feedback stats fetch failed:', statsError);
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
    channel_name: v.channel_name,
    segment_count: v.segment_count,
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

  try {
    await query('UPDATE videos SET review_status = $2 WHERE id = $1', [videoId, review_status]);
  } catch (error) {
    console.error('Review update failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, videoId, review_status });
}
