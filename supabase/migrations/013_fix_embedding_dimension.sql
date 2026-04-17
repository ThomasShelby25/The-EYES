-- Migration: 013_fix_embedding_dimension.sql
-- Description: Updates embedding dimension from 1536 (OpenAI) to 768 (Gemini)
-- Author: Antigravity Deep Analysis Fix

-- 1. Update the match_embeddings function first (drop and recreate to change argument type)
DROP FUNCTION IF EXISTS match_embeddings(vector(1536), float, int, uuid);

CREATE OR REPLACE FUNCTION match_embeddings (
  query_embedding vector(768),
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION match_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION match_embeddings TO service_role;

-- 2. Update the embeddings table
-- Note: This will fail if there is existing 1536 data that doesn't cast.
-- We cast to float[] then to vector(768) which effectively truncates or errors.
-- For a clean migration in a beta app, we truncate the table to force re-indexing.
TRUNCATE TABLE embeddings;

ALTER TABLE embeddings 
  ALTER COLUMN embedding TYPE vector(768);

-- 3. Log the change for audit
COMMENT ON TABLE embeddings IS 'Updated to 768 dimensions for Gemini text-embedding-004';
