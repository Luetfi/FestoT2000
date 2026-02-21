/**
 * Standalone script to ingest all videos from a YouTube channel.
 * Does NOT import from src/ to avoid server-only / path alias issues.
 *
 * Usage: npx tsx scripts/ingest-channel.ts <channelId> [concurrency] [maxVideos]
 * Env:   Reads from .env.local via --env-file flag
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { fetchTranscript } from 'youtube-transcript-plus';

// --- Config from env ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

for (const [k, v] of Object.entries({ YOUTUBE_API_KEY, SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}

// --- Clients ---
const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- CLI args ---
const CHANNEL_ID = process.argv[2];
const CONCURRENCY = parseInt(process.argv[3] || '3', 10);
const MAX_VIDEOS = parseInt(process.argv[4] || '500', 10);

if (!CHANNEL_ID) {
  console.error('Usage: node --env-file=.env.local npx tsx scripts/ingest-channel.ts <channelId> [concurrency] [maxVideos]');
  process.exit(1);
}

// ============================================================
// YouTube helpers
// ============================================================

async function fetchChannelVideoIds(channelId: string, max: number): Promise<string[]> {
  const chRes = await youtube.channels.list({ part: ['contentDetails'], id: [channelId] });
  const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error(`No uploads playlist for ${channelId}`);

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsId,
      maxResults: 50,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);

  return ids.slice(0, max);
}

interface VideoMeta {
  videoId: string; title: string; description: string | null;
  channelId: string; channelTitle: string; thumbnailUrl: string | null;
  publishedAt: string | null; durationSeconds: number | null;
}

function parseDuration(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return +(m[1]||0)*3600 + +(m[2]||0)*60 + +(m[3]||0);
}

async function fetchVideoMetadata(videoId: string): Promise<VideoMeta> {
  const res = await youtube.videos.list({ part: ['snippet','contentDetails'], id: [videoId] });
  const v = res.data.items?.[0];
  if (!v?.snippet) throw new Error(`Video not found: ${videoId}`);
  const s = v.snippet;
  return {
    videoId,
    title: s.title || 'Untitled',
    description: s.description || null,
    channelId: s.channelId || '',
    channelTitle: s.channelTitle || 'Unknown',
    thumbnailUrl: s.thumbnails?.high?.url || s.thumbnails?.default?.url || null,
    publishedAt: s.publishedAt || null,
    durationSeconds: parseDuration(v.contentDetails?.duration),
  };
}

// ============================================================
// Transcript
// ============================================================

interface TSegment { text: string; offset: number; duration: number; }

async function getTranscript(videoId: string): Promise<{ segments: TSegment[]; language: string } | null> {
  for (const lang of ['de', 'en']) {
    try {
      const subs = await fetchTranscript(videoId, { lang });
      if (subs && subs.length > 0) {
        return {
          segments: subs.map(s => ({ text: s.text, offset: Math.round(s.offset*1000), duration: Math.round(s.duration*1000) })),
          language: lang,
        };
      }
    } catch { /* next language */ }
  }
  return null;
}

// ============================================================
// Chunking (same logic as src/lib/ingestion/chunker.ts)
// ============================================================

interface Chunk { text: string; startTime: number; endTime: number; }

function chunkTranscript(segments: TSegment[], target = 800, overlapPct = 0.15): Chunk[] {
  if (!segments.length) return [];
  const chunks: Chunk[] = [];
  const overlapSize = Math.floor(target * overlapPct);
  let curText = '', curStart = segments[0].offset, curEnd = segments[0].offset;

  for (const seg of segments) {
    curText += (curText ? ' ' : '') + seg.text.trim();
    curEnd = seg.offset + seg.duration;

    if (curText.length >= target) {
      chunks.push({ text: curText.trim(), startTime: curStart/1000, endTime: curEnd/1000 });
      // overlap
      if (curText.length > overlapSize) {
        const raw = curText.slice(-overlapSize);
        const sm = raw.match(/[.!?]\s+([A-ZÄÖÜ])/);
        let overlap = raw;
        if (sm?.index !== undefined && sm.index < raw.length * 0.7) {
          overlap = raw.slice(sm.index + sm[0].length - 1);
        }
        curText = overlap;
        curStart = curEnd - Math.floor((overlap.length / curText.length) * (curEnd - curStart) || 0);
      } else {
        curText = '';
        curStart = curEnd;
      }
    }
  }
  if (curText.trim()) {
    chunks.push({ text: curText.trim(), startTime: curStart/1000, endTime: curEnd/1000 });
  }
  return chunks;
}

// ============================================================
// Embeddings
// ============================================================

async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  });
  return res.data.sort((a,b) => a.index - b.index).map(d => d.embedding);
}

// ============================================================
// Channel classification (mirrors src/lib/youtube/api.ts)
// ============================================================

function classifyChannel(name: string): 'official' | 'community' {
  const n = name.toLowerCase().trim();
  const blocklist = (process.env.CHANNEL_BLOCKLIST || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (blocklist.some(b => n.includes(b))) return 'community';
  const allowlist = (process.env.CHANNEL_ALLOWLIST || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.some(a => n.includes(a))) return 'official';
  return n.includes('festo') ? 'official' : 'community';
}

// ============================================================
// Ingestion pipeline (mirrors src/lib/ingestion/pipeline.ts)
// ============================================================

interface Result { videoId: string; status: 'success'|'no_transcript'|'error'; segments: number; error?: string; }

async function ingestVideo(videoId: string): Promise<Result> {
  try {
    const meta = await fetchVideoMetadata(videoId);

    // Upsert channel
    let channelDbId: number;
    const { data: existing } = await supabase.from('channels').select('id').eq('youtube_id', meta.channelId).maybeSingle();
    if (existing) {
      channelDbId = (existing as any).id;
    } else {
      const chRes = await youtube.channels.list({ part: ['snippet'], id: [meta.channelId] });
      const chSnip = chRes.data.items?.[0]?.snippet;
      const { data: newCh, error: chErr } = await supabase.from('channels').insert({
        youtube_id: meta.channelId,
        name: chSnip?.title || 'Unknown',
        description: chSnip?.description || null,
        thumbnail_url: chSnip?.thumbnails?.high?.url || null,
        official_status: classifyChannel(chSnip?.title || ''),
      } as any).select('id').single();
      if (chErr || !newCh) throw chErr || new Error('channel insert failed');
      channelDbId = (newCh as any).id;
    }

    // Upsert video
    const { data: video, error: vErr } = await supabase.from('videos').upsert({
      youtube_id: videoId,
      channel_id: channelDbId,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnailUrl,
      duration_seconds: meta.durationSeconds,
      published_at: meta.publishedAt,
      has_transcript: false,
    } as any, { onConflict: 'youtube_id' }).select('id').single();
    if (vErr || !video) throw vErr || new Error('video upsert failed');
    const videoDbId = (video as any).id;

    // Transcript
    const transcript = await getTranscript(videoId);
    if (!transcript) return { videoId, status: 'no_transcript', segments: 0 };

    // Delete old transcripts for re-ingestion
    await supabase.from('transcripts').delete().eq('video_id', videoDbId);

    const fullText = transcript.segments.map(s => s.text).join(' ');
    const { data: tRow, error: tErr } = await supabase.from('transcripts').insert({
      video_id: videoDbId,
      full_text: fullText,
      language: transcript.language,
      source_type: 'unknown',
    } as any).select('id').single();
    if (tErr || !tRow) throw tErr || new Error('transcript insert failed');

    await supabase.from('videos').update({ has_transcript: true } as any).eq('id', videoDbId);

    // Chunk + embed
    const chunks = chunkTranscript(transcript.segments);
    if (!chunks.length) return { videoId, status: 'no_transcript', segments: 0 };

    const embeddings = await embed(chunks.map(c => c.text));

    const segRows = chunks.map((c, i) => ({
      video_id: videoDbId,
      transcript_id: (tRow as any).id,
      text: c.text,
      start_time: c.startTime,
      end_time: c.endTime,
      embedding: embeddings[i],
    }));

    const { error: sErr } = await supabase.from('segments').insert(segRows as any);
    if (sErr) throw sErr;

    return { videoId, status: 'success', segments: chunks.length };
  } catch (e: any) {
    return { videoId, status: 'error', segments: 0, error: e?.message || String(e) };
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\nChannel: ${CHANNEL_ID}`);
  console.log(`Concurrency: ${CONCURRENCY}, Max videos: ${MAX_VIDEOS}\n`);

  console.log('Fetching video IDs from uploads playlist...');
  const videoIds = await fetchChannelVideoIds(CHANNEL_ID, MAX_VIDEOS);
  console.log(`Found ${videoIds.length} videos.\n`);

  if (!videoIds.length) return;

  // Quota estimate
  const quotaEst = 1 + Math.ceil(videoIds.length / 50) + videoIds.length;
  console.log(`Est. YouTube API quota: ~${quotaEst} / 10,000\n`);

  const results: Result[] = [];
  const startTime = Date.now();

  for (let i = 0; i < videoIds.length; i += CONCURRENCY) {
    const batch = videoIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(id => ingestVideo(id)));

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      const idx = i + j + 1;
      if (r.status === 'fulfilled') {
        const v = r.value;
        const icon = v.status === 'success' ? '+' : v.status === 'no_transcript' ? '-' : '!';
        console.log(`[${idx}/${videoIds.length}] ${icon} ${v.videoId} — ${v.status}${v.segments ? ` (${v.segments} seg)` : ''}${v.error ? ` ERR: ${v.error}` : ''}`);
        results.push(v);
      } else {
        console.error(`[${idx}/${videoIds.length}] ! ${batch[j]} — FATAL: ${r.reason}`);
        results.push({ videoId: batch[j], status: 'error', segments: 0, error: String(r.reason) });
      }
    }

    // Brief pause between batches
    if (i + CONCURRENCY < videoIds.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const ok = results.filter(r => r.status === 'success');
  const noT = results.filter(r => r.status === 'no_transcript');
  const errs = results.filter(r => r.status === 'error');
  const segs = results.reduce((s, r) => s + r.segments, 0);

  console.log(`\n=== DONE (${elapsed}s) ===`);
  console.log(`Success:        ${ok.length} videos, ${segs} segments`);
  console.log(`No transcript:  ${noT.length}`);
  console.log(`Errors:         ${errs.length}`);
  console.log(`Quota used:     ~${1 + Math.ceil(videoIds.length/50) + ok.length + noT.length} / 10,000`);

  if (errs.length) {
    console.log(`\nFailed:`);
    errs.forEach(r => console.log(`  ${r.videoId}: ${r.error}`));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
