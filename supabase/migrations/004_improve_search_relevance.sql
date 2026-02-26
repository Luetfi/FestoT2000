-- Extend hybrid_search_segments to return raw cosine similarity
-- This enables client-side relevance filtering to remove semantically irrelevant results

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
  semantic_similarity float
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
  WHERE segments.embedding IS NOT NULL
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
    row_number() OVER (ORDER BY ts_rank_cd(segments.text_tsv, websearch_to_tsquery('german', query_text)) DESC) AS rank_ix
  FROM segments
  WHERE segments.text_tsv @@ websearch_to_tsquery('german', query_text)
  ORDER BY ts_rank_cd(segments.text_tsv, websearch_to_tsquery('german', query_text)) DESC
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
  COALESCE(semantic.similarity, 0.0) AS semantic_similarity
FROM semantic
FULL OUTER JOIN full_text ON semantic.id = full_text.id
ORDER BY rrf_score DESC
LIMIT match_count;
$$;
