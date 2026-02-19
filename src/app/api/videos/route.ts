import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error }: { data: any[] | null; error: any } = await supabase
      .from('videos')
      .select(`
        id,
        youtube_id,
        title,
        description,
        thumbnail_url,
        duration_seconds,
        channels (
          name,
          official_status
        )
      `)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Videos fetch error:', error);
      return NextResponse.json(
        { error: `Failed to fetch videos: ${error.message}` },
        { status: 500 }
      );
    }

    const videos = (data || []).map((video) => {
      const channel = video.channels?.[0] || video.channels;
      return {
        id: video.id,
        youtube_id: video.youtube_id,
        title: video.title,
        description: video.description,
        thumbnail_url: video.thumbnail_url,
        duration_seconds: video.duration_seconds,
        channel_name: channel?.name ?? 'Unknown',
        channel_official_status: channel?.official_status ?? 'unknown',
      };
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Videos API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
