#!/usr/bin/env node
// Standalone seed script – runs directly with Node.js, no Next.js needed
// Usage: node scripts/seed-10-videos.mjs

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import OpenAI from 'openai';
import { fetchTranscript } from 'youtube-transcript-plus';

// ── Config ──
const SUPABASE_URL = 'https://epdtzrsgukrxecaitlzy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZHR6cnNndWtyeGVjYWl0bHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxNDYwOSwiZXhwIjoyMDg0OTkwNjA5fQ.bIt2_7YRZwwu2L-XxlUl36shzlYyQ8Y5qzQ2himduQM';
const YOUTUBE_API_KEY = 'AIzaSyD7GbDP-L8nv0ZWNS0tBLiT1G6M1r-unos';
const OPENAI_API_KEY = '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';

const VIDEO_IDS = [
  'd0azd19R3w4',
  'NXhXM5od0Ag',
  'CTxCws_fEDs',
  'NPQ_Exfhiq8',
  'JFtN-JtekV4',
  '9bamyXYjjT8',
  '8mX5WnMCeHI',
  'DtLtlPN9Y9o',
  'KghlfJmy7B0',
  'WW2pDFKMN5M',
];

// ── Clients ──
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Helpers ──
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function parseDuration(duration) {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return parseInt(match[1] || '0') * 3600 + parseInt(match[2] || '0') * 60 + parseInt(match[3] || '0');
}

function classifyChannel(name) {
  return name.toLowerCase().includes('festo') ? 'official' : 'community';
}

function chunkTranscript(segments, targetSize = 800, overlapPct = 0.15) {
  if (!segments.length) return [];
  const chunks = [];
  const overlapSize = Math.floor(targetSize * overlapPct);
  let text = '';
  let startOffset = segments[0].offset;
  let endOffset = segments[0].offset;
  let lastIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const add = text.length > 0 ? ' ' + seg.text.trim() : seg.text.trim();
    text += add;
    endOffset = seg.offset + seg.duration;

    if (text.length >= targetSize) {
      chunks.push({ text: text.trim(), startTime: startOffset / 1000, endTime: endOffset / 1000 });
      if (text.length > overlapSize) {
        const overlap = text.slice(-overlapSize);
        const overlapStart = segments[lastIdx].offset +
          Math.floor((segments[lastIdx].duration * (text.length - overlapSize)) / text.length);
        text = overlap;
        startOffset = overlapStart;
        lastIdx = i;
      } else {
        text = '';
        if (i + 1 < segments.length) { startOffset = segments[i + 1].offset; lastIdx = i + 1; }
      }
    }
  }
  if (text.trim().length > 0) {
    chunks.push({ text: text.trim(), startTime: startOffset / 1000, endTime: endOffset / 1000 });
  }
  return chunks;
}

async function fetchVideoMeta(videoId) {
  const res = await youtube.videos.list({ part: ['snippet', 'contentDetails'], id: [videoId] });
  const item = res.data.items?.[0];
  if (!item?.snippet) throw new Error(`Video not found: ${videoId}`);
  const s = item.snippet;
  return {
    videoId, title: s.title || 'Untitled', description: s.description || null,
    channelId: s.channelId || '', channelTitle: s.channelTitle || 'Unknown',
    thumbnailUrl: s.thumbnails?.high?.url || s.thumbnails?.default?.url || null,
    publishedAt: s.publishedAt || null,
    durationSeconds: parseDuration(item.contentDetails?.duration),
  };
}

async function fetchChannelMeta(channelId) {
  const res = await youtube.channels.list({ part: ['snippet'], id: [channelId] });
  const item = res.data.items?.[0];
  if (!item?.snippet) throw new Error(`Channel not found: ${channelId}`);
  const s = item.snippet;
  return {
    channelId, name: s.title || 'Unknown',
    description: s.description || null,
    thumbnailUrl: s.thumbnails?.high?.url || s.thumbnails?.default?.url || null,
  };
}

async function getTranscript(videoId) {
  for (const lang of ['de', 'en']) {
    try {
      const subs = await fetchTranscript(videoId, { lang });
      if (subs?.length) {
        return {
          segments: subs.map(s => ({ text: s.text, offset: Math.round(s.offset * 1000), duration: Math.round(s.duration * 1000) })),
          language: lang, available: true,
        };
      }
    } catch { /* try next */ }
  }
  return { segments: [], language: 'unknown', available: false };
}

async function generateEmbeddings(texts) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts, encoding_format: 'float' });
  return res.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

// ── Main ingestion ──
async function ingestVideo(videoId, index, total) {
  const prefix = `[${index + 1}/${total}] ${videoId}`;
  try {
    // 1. Video metadata
    log(`${prefix} – YouTube Metadaten laden...`);
    const meta = await fetchVideoMeta(videoId);
    log(`${prefix} – "${meta.title.substring(0, 60)}"`);

    // 2. Channel upsert
    const { data: existingCh } = await supabase.from('channels').select('id').eq('youtube_id', meta.channelId).maybeSingle();
    let channelDbId;
    if (existingCh) {
      channelDbId = existingCh.id;
    } else {
      log(`${prefix} – Channel "${meta.channelTitle}" anlegen...`);
      const chMeta = await fetchChannelMeta(meta.channelId);
      const { data: newCh, error } = await supabase.from('channels')
        .insert({ youtube_id: chMeta.channelId, name: chMeta.name, description: chMeta.description, thumbnail_url: chMeta.thumbnailUrl, official_status: classifyChannel(chMeta.name) })
        .select('id').single();
      if (error) throw error;
      channelDbId = newCh.id;
    }

    // 3. Video upsert
    const { data: video, error: vErr } = await supabase.from('videos')
      .upsert({ youtube_id: videoId, channel_id: channelDbId, title: meta.title, description: meta.description, thumbnail_url: meta.thumbnailUrl, duration_seconds: meta.durationSeconds, published_at: meta.publishedAt, has_transcript: false }, { onConflict: 'youtube_id' })
      .select('id').single();
    if (vErr) throw vErr;

    // 4. Transcript
    log(`${prefix} – Transkript laden...`);
    const tr = await getTranscript(videoId);
    if (!tr.available) {
      log(`${prefix} – KEIN TRANSKRIPT verfügbar, überspringe.`);
      return { videoId, status: 'no_transcript', segments: 0 };
    }
    log(`${prefix} – Transkript: ${tr.segments.length} Untertitel (${tr.language})`);

    const fullText = tr.segments.map(s => s.text).join(' ');
    const { data: transcript, error: tErr } = await supabase.from('transcripts')
      .insert({ video_id: video.id, full_text: fullText, language: tr.language, source_type: 'unknown' })
      .select('id').single();
    if (tErr) throw tErr;

    await supabase.from('videos').update({ has_transcript: true }).eq('id', video.id);

    // 5. Chunk
    const chunks = chunkTranscript(tr.segments);
    if (chunks.length === 0) {
      log(`${prefix} – Leeres Transkript, überspringe.`);
      return { videoId, status: 'no_transcript', segments: 0 };
    }
    log(`${prefix} – ${chunks.length} Chunks erstellt, Embeddings generieren...`);

    // 6. Embeddings
    const embeddings = await generateEmbeddings(chunks.map(c => c.text));

    // 7. Store segments
    const records = chunks.map((c, i) => ({
      video_id: video.id, transcript_id: transcript.id,
      text: c.text, start_time: c.startTime, end_time: c.endTime, embedding: embeddings[i],
    }));
    const { error: sErr } = await supabase.from('segments').insert(records);
    if (sErr) throw sErr;

    log(`${prefix} – OK! ${chunks.length} Segmente gespeichert.`);
    return { videoId, status: 'success', segments: chunks.length };
  } catch (err) {
    log(`${prefix} – FEHLER: ${err.message}`);
    return { videoId, status: 'error', segments: 0, error: err.message };
  }
}

// ── Run ──
async function main() {
  console.log('');
  log('=== FESTO VIDEO SEED – 10 Videos ===');
  log('');
  const start = Date.now();
  const results = [];

  for (let i = 0; i < VIDEO_IDS.length; i++) {
    const result = await ingestVideo(VIDEO_IDS[i], i, VIDEO_IDS.length);
    results.push(result);
    log('');
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const ok = results.filter(r => r.status === 'success');
  const noTr = results.filter(r => r.status === 'no_transcript');
  const errs = results.filter(r => r.status === 'error');
  const totalSegs = results.reduce((s, r) => s + r.segments, 0);

  log('=== FERTIG ===');
  log(`Zeit: ${elapsed}s`);
  log(`Erfolgreich: ${ok.length} | Kein Transkript: ${noTr.length} | Fehler: ${errs.length}`);
  log(`Segmente gesamt: ${totalSegs}`);
  console.log('');
  console.table(results.map(r => ({ Video: r.videoId, Status: r.status, Segmente: r.segments, Fehler: r.error || '' })));
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
