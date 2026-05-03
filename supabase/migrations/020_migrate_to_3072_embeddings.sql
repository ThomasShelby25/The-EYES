-- MIGRATION: Update to 3072 dimensions for gemini-embedding-001

DROP FUNCTION IF EXISTS hybrid_search(text, vector(768), int, uuid, timestamp, timestamp);
DROP FUNCTION IF EXISTS match_embeddings(vector(768), float, int, uuid);

TRUNCATE TABLE embeddings;

-- Drop the HNSW index because it has a 2000-dimension limit in pgvector
DROP INDEX IF EXISTS embeddings_hnsw_idx;

ALTER TABLE embeddings 
  ALTER COLUMN embedding TYPE vector(3072);

CREATE OR REPLACE FUNCTION match_embeddings (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  user_id_arg uuid
)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    embeddings.id,
    embeddings.event_id,
    embeddings.content,
    1 - (embeddings.embedding <=> query_embedding) AS similarity
  FROM embeddings
  WHERE embeddings.user_id = user_id_arg
    AND 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(3072),
  match_count INT,
  user_id_arg UUID,
  start_date TIMESTAMP DEFAULT NULL,
  end_date TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.content,
    (1 - (emb.embedding <=> query_embedding))::FLOAT as similarity,
    ts_rank_cd(re.fts, websearch_to_tsquery('english', query_text))::FLOAT as keyword_rank,
    (
      (1 - (emb.embedding <=> query_embedding)) * 0.7 + 
      ts_rank_cd(re.fts, websearch_to_tsquery('english', query_text)) * 0.3
    )::FLOAT as combined_score
  FROM raw_events re
  JOIN embeddings emb ON re.id = emb.event_id
  WHERE re.user_id = user_id_arg
    AND (start_date IS NULL OR re.timestamp >= start_date)
    AND (end_date IS NULL OR re.timestamp <= end_date)
    AND (
      (1 - (emb.embedding <=> query_embedding)) > 0.35 OR
      re.fts @@ websearch_to_tsquery('english', query_text)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION match_embeddings TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search TO service_role;

COMMENT ON TABLE embeddings IS 'Migrated to 3072 dimensions for Google Gemini (gemini-embedding-001).';
