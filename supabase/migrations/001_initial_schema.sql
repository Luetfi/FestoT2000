-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Channels table
-- Stores YouTube channel info with official/unofficial classification
CREATE TABLE channels (
  id BIGSERIAL PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  official_status TEXT CHECK (official_status IN ('official', 'community', 'unknown')) DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos table
-- Stores video metadata with unique youtube_id index
CREATE TABLE videos (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TIMESTAMPTZ,
  has_transcript BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcripts table
-- Stores full transcript text and source type
CREATE TABLE transcripts (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  language TEXT DEFAULT 'unknown',
  source_type TEXT CHECK (source_type IN ('manual', 'auto', 'unknown')) DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segments table
-- Stores segment text, timestamps, and embedding vector with HNSW index
CREATE TABLE segments (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
  transcript_id BIGINT REFERENCES transcripts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  text_tsv tsvector GENERATED ALWAYS AS (to_tsvector('german', text)) STORED,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  embedding vector(1536),  -- text-embedding-3-small dimensions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for vector similarity search
-- Uses cosine distance operator for semantic search
CREATE INDEX segments_embedding_idx ON segments
USING hnsw (embedding vector_cosine_ops);

-- GIN index for full-text search fallback
CREATE INDEX segments_text_tsv_idx ON segments USING gin(text_tsv);

-- Additional indexes for performance
CREATE INDEX videos_youtube_id_idx ON videos(youtube_id);
CREATE INDEX videos_channel_id_idx ON videos(channel_id);
CREATE INDEX segments_video_id_idx ON segments(video_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION search_segments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  video_id bigint,
  text text,
  start_time float,
  end_time float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    segments.id,
    segments.video_id,
    segments.text,
    segments.start_time,
    segments.end_time,
    1 - (segments.embedding <=> query_embedding) AS similarity
  FROM segments
  WHERE segments.embedding IS NOT NULL
    AND 1 - (segments.embedding <=> query_embedding) > match_threshold
  ORDER BY segments.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
-- Allow anonymous SELECT on public tables
-- Note: TO anon, authenticated ensures both anonymous and logged-in users can read

CREATE POLICY "Allow public read on channels"
ON channels FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public read on videos"
ON videos FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public read on transcripts"
ON transcripts FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public read on segments"
ON segments FOR SELECT
TO anon, authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policies for other tables
-- Service role bypasses RLS, so no explicit policies needed for admin operations
-- Only service role (used in API routes) can modify channels, videos, transcripts, segments

-- Grant necessary permissions to anon role for RPC functions
GRANT EXECUTE ON FUNCTION search_segments TO anon, authenticated;
