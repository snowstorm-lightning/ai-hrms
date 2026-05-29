-- P2 RAG upgrade: allow production embedding dimensions instead of the
-- deterministic demo-only vector(8) shape from the initial AI-native seed.
ALTER TABLE rag_embeddings
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_provider_model_dim
  ON rag_embeddings (provider, model, dimensions);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_chunk_id
  ON rag_embeddings (chunk_id);

CREATE INDEX IF NOT EXISTS idx_rag_retrieval_logs_created_at
  ON rag_retrieval_logs (created_at DESC);
