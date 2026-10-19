import 'server-only';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query<{
      id: number;
      youtube_id: string;
      title: string;
      description: string | null;
      thumbnail_url: string | null;
      duration_seconds: number | null;
      channel_name: string | null;
      channel_official_status: string | null;
    }>(
      `SELECT v.id, v.youtube_id, v.title, v.description, v.thumbnail_url, v.duration_seconds,
              c.name AS channel_name, c.official_status AS channel_official_status
       FROM videos v
       LEFT JOIN channels c ON c.id = v.channel_id
       ORDER BY v.published_at DESC`
    );

    const videos = rows.map((video) => ({
      ...video,
      channel_name: video.channel_name ?? 'Unknown',
      channel_official_status: video.channel_official_status ?? 'unknown',
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Videos API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
