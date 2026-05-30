# RAG Chunking Strategy

AI-HRMS uses a pragmatic local-first chunking strategy for the current
PostgreSQL/pgvector + local embedding setup.

## What Is Implemented

Current production chunking is:

1. Prompt-injection cleanup for known instruction hijack phrases.
2. Markdown heading-aware section parsing.
3. Sentence-aware splitting that preserves punctuation.
4. Section boundary preservation: chunks are not merged across headings.
5. Body target size: 760 runes.
6. Overlap context: 120 trailing runes from the previous chunk in the same
   section.
7. Contextual prefix before embedding and storage:
   - document title;
   - section path;
   - previous overlap when present;
   - body marker.
8. Query-side instruction before vector search:
   `Instruct: Retrieve the most relevant AI-HRMS passages ... Query: ...`

Example stored chunk:

```text
文档：企鹅科技 HR 手册
章节：新人入职指南 > RAG 引用核验
上文：上一片段的末尾上下文
正文：当前片段内容
```

This improves retrieval without adding another model call during ingestion.

## Why This Shape

For the current local model, `Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0`, the
priority is to use Qwen3's stronger 1024-dimensional instruction-aware retrieval
without exceeding the local llama.cpp `ctx-size=2048` budget. The project
therefore uses larger, structure-preserving chunks and query instructions, but
still avoids expensive LLM-per-chunk contextualization by default.

The design borrows from current RAG practice:

- Preserve document structure rather than splitting only by fixed length.
- Keep exact lexical retrieval as a fallback for identifiers and policy names.
- Add lightweight chunk context so chunks keep document and section meaning.
- Use query instructions because Qwen3 Embedding is instruction-aware and the
  official model guidance recommends scenario-specific retrieval instructions.
- Keep chunk size below the local context budget after prefix and overlap.

## Not Yet Implemented By Default

- Late chunking: Qwen3 supports long context, but the current llama.cpp
  OpenAI-compatible embedding endpoint is operated with `ctx-size=2048` for
  memory control and does not expose the token-level pooling pipeline needed for
  late chunking in this app.
- LLM contextual retrieval: generating 50-100 token context for every chunk can
  improve accuracy, but it adds cost, latency, provider dependency, and data
  governance work. It should be optional and audit-logged if added.
- Semantic splitting: embedding adjacent sentences to find topic breakpoints can
  help long narrative documents. For HR policy docs, heading-aware chunking is
  cheaper and more predictable as the default.
- Reranking: useful after vector + lexical retrieval, but should be a separate
  retrieval stage rather than hidden inside chunking.

## Upgrade Path

P1 retrieval upgrade:

1. Add BM25/full-text ranking next to vector search.
2. Use reciprocal rank fusion to combine lexical and vector hits.
3. Add a reranker for top 50 to top 8 only when the query is broad or ambiguous.

P2 ingestion upgrade:

1. Add optional semantic splitter for long unstructured articles.
2. Add optional LLM contextualization only for public/internal-safe documents.
3. Store chunk metadata fields such as `section_path`, `start_offset`, and
   `chunk_strategy` in a schema migration.

P3 model upgrade:

1. Evaluate long-context embedding models.
2. Add late chunking only when the embedding service exposes token-level or
   chunked pooling support.
