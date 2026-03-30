import 'server-only';
import { notFound } from 'next/navigation';
import { VideoDetailClient } from '@/components/video/video-detail-client';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { generateSummaries } from '@/lib/openai/summaries';
import type { OfficialStatus } from '@/types/search';

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; segment?: string; q?: string }>;
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const { lang: langParam, segment: segmentParam, q: queryParam } = await searchParams;
  const lang = isValidLocale(langParam) ? langParam : defaultLocale;
  const dict = await getDictionary(lang);

  // Parse video ID as number for DB query
  const videoId = parseInt(id, 10);
  if (isNaN(videoId)) {
    notFound();
  }

  const supabase = getSupabaseAdmin();

  // Load video with channel data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: video }: { data: any } = await supabase
    .from('videos')
    .select(`
      id,
      youtube_id,
      title,
      description,
      thumbnail_url,
      duration_seconds,
      has_transcript,
      channels (
        name,
        official_status
      )
    `)
    .eq('id', videoId)
    .single();

  if (!video) {
    notFound();
  }

  const channel = video.channels?.[0] || video.channels;

  // Load ALL segments for this video
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: segmentRows }: { data: any[] | null } = await supabase
    .from('segments')
    .select('id, text, summary, start_time, end_time')
    .eq('video_id', videoId)
    .order('start_time', { ascending: true });

  let segments = (segmentRows || []).map((row: any) => ({
    id: String(row.id),
    text: row.text,
    summary: row.summary ?? null,
    start_time: row.start_time,
    end_time: row.end_time,
  }));

  // Generate missing summaries on-the-fly and cache them
  const missingSummarySegs = segments.filter((s) => !s.summary);
  if (missingSummarySegs.length > 0) {
    const newSummaries = await generateSummaries(missingSummarySegs.map((s) => s.text));
    const summaryMap = new Map<string, string>();
    for (let i = 0; i < missingSummarySegs.length; i++) {
      const summary = newSummaries[i];
      if (summary) {
        summaryMap.set(missingSummarySegs[i].id, summary);
        // Cache in DB (fire-and-forget)
        // @ts-expect-error supabase generic inference
        supabase.from('segments').update({ summary }).eq('id', parseInt(missingSummarySegs[i].id, 10));
      }
    }
    segments = segments.map((s) => ({
      ...s,
      summary: s.summary || summaryMap.get(s.id) || null,
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <VideoDetailClient
          video={{
            videoYoutubeId: video.youtube_id ?? '',
            videoTitle: video.title ?? '',
            videoDescription: video.description ?? null,
            videoDurationSeconds: video.duration_seconds ?? null,
            videoHasTranscript: video.has_transcript ?? false,
            channelName: channel?.name ?? 'Unknown',
            channelOfficialStatus: (channel?.official_status as OfficialStatus) ?? 'unknown',
          }}
          segments={segments}
          initialSegmentId={segmentParam ?? null}
          searchQuery={queryParam ?? null}
          lang={lang}
          labels={{
            back: dict.back,
            official: dict.officialLabel,
            community: dict.communityLabel,
            openOnYouTube: dict.openOnYouTube,
            videoDuration: dict.videoDuration,
            noTranscriptNotice: dict.noTranscriptNotice,
            chapters: dict.chapters,
            segmentCount: dict.segmentCount,
            noChapters: dict.noChapters,
            transcript: dict.transcript,
            generatingExplanation: dict.generatingExplanation,
            explanationError: dict.explanationError,
            yourAnswer: dict.yourAnswer,
            allChapters: dict.allChapters,
            videoDescription: dict.videoDescription,
            showDescription: dict.showDescription,
            hideDescription: dict.hideDescription,
          }}
        />
      </main>
    </div>
  );
}
