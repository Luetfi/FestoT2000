/**
 * Ingest a single video by ID.
 * Usage: npx tsx --env-file=.env.local scripts/ingest-single.ts <videoId>
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
// @ts-ignore
import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const VIDEO_ID = process.argv[2];
if (!VIDEO_ID) { console.error('Usage: npx tsx --env-file=.env.local scripts/ingest-single.ts <videoId>'); process.exit(1); }

function parseDuration(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return +(m[1]||0)*3600 + +(m[2]||0)*60 + +(m[3]||0);
}

function classifyChannel(name: string): 'official' | 'community' {
  const n = name.toLowerCase().trim();
  return n.includes('festo') ? 'official' : 'community';
}

async function main() {
  console.log(`Ingesting video: ${VIDEO_ID}`);

  // 1. Fetch metadata
  const res = await youtube.videos.list({ part: ['snippet', 'contentDetails'], id: [VIDEO_ID] });
  const v = res.data.items?.[0];
  if (!v?.snippet) { console.error('Video not found'); process.exit(1); }
  const s = v.snippet;
  console.log(`Title: ${s.title}`);
  console.log(`Channel: ${s.channelTitle} (${s.channelId})`);

  // 2. Upsert channel
  let channelDbId: number;
  const { data: existingCh } = await supabase.from('channels').select('id').eq('youtube_id', s.channelId!).maybeSingle();
  if (existingCh) {
    channelDbId = (existingCh as any).id;
    console.log(`Channel exists (DB ID: ${channelDbId})`);
  } else {
    const chRes = await youtube.channels.list({ part: ['snippet'], id: [s.channelId!] });
    const chSnip = chRes.data.items?.[0]?.snippet;
    const { data: newCh, error: chErr } = await supabase.from('channels').insert({
      youtube_id: s.channelId,
      name: chSnip?.title || 'Unknown',
      description: chSnip?.description || null,
      thumbnail_url: chSnip?.thumbnails?.high?.url || null,
      official_status: classifyChannel(chSnip?.title || ''),
    } as any).select('id').single();
    if (chErr || !newCh) { console.error('Channel insert error:', chErr); process.exit(1); }
    channelDbId = (newCh as any).id;
    console.log(`Created channel (DB ID: ${channelDbId})`);
  }

  // 3. Upsert video
  const dur = parseDuration(v.contentDetails?.duration);
  const { data: video, error: vErr } = await supabase.from('videos').upsert({
    youtube_id: VIDEO_ID, channel_id: channelDbId, title: s.title,
    description: s.description || null, thumbnail_url: s.thumbnails?.high?.url || null,
    duration_seconds: dur, published_at: s.publishedAt || null, has_transcript: false,
  } as any, { onConflict: 'youtube_id' }).select('id').single();
  if (vErr || !video) { console.error('Video upsert error:', vErr); process.exit(1); }
  const videoDbId = (video as any).id;
  console.log(`Video DB ID: ${videoDbId}`);

  // 4. Transcript
  let transcript: { segments: any[]; language: string } | null = null;
  for (const lang of ['de', 'en']) {
    try {
      const subs = await fetchTranscript(VIDEO_ID, { lang });
      if (subs?.length) {
        transcript = {
          segments: subs.map((x: any) => ({ text: x.text, offset: Math.round(x.offset), duration: Math.round(x.duration) })),
          language: lang,
        };
        break;
      }
    } catch { /* next */ }
  }
  if (!transcript) { console.log('No DE/EN transcript - SKIPPED'); process.exit(0); }
  console.log(`Transcript: ${transcript.language}, ${transcript.segments.length} raw segments`);

  // 5. Clean old data
  await supabase.from('segments').delete().eq('video_id', videoDbId);
  await supabase.from('transcripts').delete().eq('video_id', videoDbId);

  const fullText = transcript.segments.map((x: any) => x.text).join(' ');
  const { data: tRow, error: tErr } = await supabase.from('transcripts').insert({
    video_id: videoDbId, full_text: fullText, language: transcript.language, source_type: 'unknown',
  } as any).select('id').single();
  if (tErr || !tRow) { console.error('Transcript insert error:', tErr); process.exit(1); }

  await supabase.from('videos').update({ has_transcript: true } as any).eq('id', videoDbId);

  // 6. Chunk
  const chunks: { text: string; startTime: number; endTime: number }[] = [];
  let curText = '', curStart = transcript.segments[0].offset, curEnd = curStart;
  for (const seg of transcript.segments) {
    curText += (curText ? ' ' : '') + seg.text.trim();
    curEnd = seg.offset + seg.duration;
    if (curText.length >= 800) {
      chunks.push({ text: curText.trim(), startTime: curStart / 1000, endTime: curEnd / 1000 });
      curText = ''; curStart = curEnd;
    }
  }
  if (curText.trim()) chunks.push({ text: curText.trim(), startTime: curStart / 1000, endTime: curEnd / 1000 });
  console.log(`Chunks: ${chunks.length}`);

  // 7. Embed + summarize
  const texts = chunks.map(c => c.text);
  const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts, encoding_format: 'float' });
  const embeddings = embRes.data.sort((a, b) => a.index - b.index).map(d => d.embedding);

  const summaries: string[] = [];
  for (const t of texts) {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 50,
      messages: [
        { role: 'system', content: 'Du fasst Transkript-Abschnitte in maximal 10 Wörtern auf Deutsch zusammen. Beschreibe WAS erklärt wird. Antworte IMMER auf Deutsch.' },
        { role: 'user', content: t },
      ],
    });
    summaries.push(r.choices[0]?.message?.content?.trim() ?? '');
  }

  // 8. Insert segments
  const segRows = chunks.map((c, i) => ({
    video_id: videoDbId, transcript_id: (tRow as any).id,
    text: c.text, summary: summaries[i] || null,
    start_time: c.startTime, end_time: c.endTime, embedding: embeddings[i],
  }));
  const { error: sErr } = await supabase.from('segments').insert(segRows as any);
  if (sErr) { console.error('Segment insert error:', sErr); process.exit(1); }

  console.log(`\nSUCCESS: ${chunks.length} segments ingested for "${s.title}"`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
