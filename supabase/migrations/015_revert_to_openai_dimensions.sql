
-- Revert embedding dimension to 1536 to match OpenAI text-embedding-3-small
-- and update the RPC search function.

-- 1. Update the match_embeddings function
DROP FUNCTION IF EXISTS match_embeddings(vector(768), float, int, uuid);
DROP FUNCTION IF EXISTS match_embeddings(vector(1536), float, int, uuid);

CREATE OR REPLACE FUNCTION match_embeddings (
  query_embedding vector(1536),
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

-- 2. Update the embeddings table
TRUNCATE TABLE embeddings; -- Clear old 768 data to avoid cast errors

ALTER TABLE embeddings 
  ALTER COLUMN embedding TYPE vector(1536);

-- 3. Log the change
COMMENT ON TABLE embeddings IS 'Reverted to 1536 dimensions to match OpenAI text-embedding-3-small for V1 Stability.';
