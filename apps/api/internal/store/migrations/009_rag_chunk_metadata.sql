-- RAG retrieval metadata for rebuildable, explainable chunking.
-- Append-only migration: do not mutate older AI-native seed migrations.
ALTER TABLE rag_chunks
  ADD COLUMN IF NOT EXISTS section_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS context_prefix text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS chunk_strategy text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS token_budget integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS body_runes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overlap_runes integer NOT NULL DEFAULT 0;

UPDATE rag_chunks
SET body_content = content,
    section_path = COALESCE(NULLIF(location_ref, ''), section_path),
    chunk_strategy = CASE WHEN chunk_strategy = 'legacy' THEN 'legacy_contextualized_text' ELSE chunk_strategy END,
    body_runes = CASE WHEN body_runes = 0 THEN char_length(content) ELSE body_runes END
WHERE body_content = ''
   OR section_path = ''
   OR chunk_strategy = 'legacy'
   OR body_runes = 0;

CREATE INDEX IF NOT EXISTS idx_rag_chunks_strategy
  ON rag_chunks (chunk_strategy);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_section_path
  ON rag_chunks (document_id, section_path);
