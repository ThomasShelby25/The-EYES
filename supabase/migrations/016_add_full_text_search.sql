
-- Update Hybrid Search (FTS) to support Date Filtering
-- This allows EYES to answer "What did I do last Tuesday?" accurately.

-- Drop the old version first
DROP FUNCTION IF EXISTS hybrid_search(text, vector(1536), int, uuid);

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search TO service_role;
