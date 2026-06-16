-- Include the video title in the full-text branch of hybrid_search_segments.
--
-- Problem: search only ever looked at segment transcript text (text_tsv) and
-- segment embeddings. The video title was never part of the searchable corpus,
-- so typing a title verbatim ("FESTO Simplified Motion Series (SMS). EMCS-ST.
-- Easy start") searched only the spoken transcript - which rarely contains the
-- marketing-style title wording. websearch_to_tsquery also AND-joins all terms,
-- so a single segment had to contain every title word, which it never did.
--
-- Fix: in the full-text branch, match against the segment text tsvector OR'd
-- with the title tsvector (segments.text_tsv || to_tsvector('german', title)).
-- A title-only query now matches because all its words live in the title part.
--
-- We also return `full_text_match` so the application can tell a keyword/title
-- match apart from a purely semantic one: a title-only match has
-- semantic_similarity = 0 and would otherwise be dropped by the absolute
-- semantic floor in relevance-filter.ts before the (title-aware) LLM judge
-- ever sees it.
--
-- Based on 006_community_review.sql; keeps its review_status = 'approved' gate
-- in both CTEs so pending/rejected videos still never surface.

-- Adding the full_text_match column changes the function's return type, which
-- CREATE OR REPLACE cannot do (Postgres error 42P13), so drop it first.
DROP FUNCTION IF EXISTS hybrid_search_segments(text, vector, integer, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION hybrid_search_segments(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50
)
RETURNS TABLE (
  id bigint,
  video_id bigint,
  text text,
  start_time float,
  end_time float,
  rrf_score float,
  semantic_similarity float,
  full_text_match boolean
)
LANGUAGE sql
AS $$
WITH semantic AS (
  SELECT
    segments.id,
    segments.video_id,
    segments.text,
    segments.start_time,
    segments.end_time,
    1 - (segments.embedding <=> query_embedding) AS similarity,
    row_number() OVER (ORDER BY segments.embedding <=> query_embedding) AS rank_ix
  FROM segments
  JOIN videos ON videos.id = segments.video_id
  WHERE segments.embedding IS NOT NULL
    AND videos.review_status = 'approved'
  ORDER BY segments.embedding <=> query_embedding
  LIMIT match_count * 2
),
full_text AS (
  SELECT
    segments.id,
    segments.video_id,
    segments.text,
    segments.start_time,
    segments.end_time,
    row_number() OVER (
      ORDER BY ts_rank_cd(
        segments.text_tsv || to_tsvector('german', coalesce(videos.title, '')),
        websearch_to_tsquery('german', query_text)
      ) DESC
    ) AS rank_ix
  FROM segments
  JOIN videos ON videos.id = segments.video_id
  WHERE (segments.text_tsv || to_tsvector('german', coalesce(videos.title, '')))
        @@ websearch_to_tsquery('german', query_text)
    AND videos.review_status = 'approved'
  ORDER BY ts_rank_cd(
    segments.text_tsv || to_tsvector('german', coalesce(videos.title, '')),
    websearch_to_tsquery('german', query_text)
  ) DESC
  LIMIT match_count * 2
)
SELECT
  COALESCE(semantic.id, full_text.id) AS id,
  COALESCE(semantic.video_id, full_text.video_id) AS video_id,
  COALESCE(semantic.text, full_text.text) AS text,
  COALESCE(semantic.start_time, full_text.start_time) AS start_time,
  COALESCE(semantic.end_time, full_text.end_time) AS end_time,
  (
    COALESCE(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight +
    COALESCE(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight
  ) AS rrf_score,
  COALESCE(semantic.similarity, 0.0) AS semantic_similarity,
  (full_text.id IS NOT NULL) AS full_text_match
FROM semantic
FULL OUTER JOIN full_text ON semantic.id = full_text.id
ORDER BY rrf_score DESC
LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION hybrid_search_segments TO anon, authenticated;
