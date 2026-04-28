-- Add HNSW Index for Vector Performance
-- This ensures vector similarity search remains fast (<100ms) even as the embeddings table grows beyond 50,000+ items.

-- First, ensure the pgvector extension is enabled (should already be, but safe to include)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the HNSW index on the embedding column using cosine distance
-- m=16 (max connections) and ef_construction=64 are good defaults for OpenAI 1536d vectors
CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx 
ON embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX embeddings_hnsw_idx IS 'HNSW index for high-performance approximate nearest neighbor search';
