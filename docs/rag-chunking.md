# RAG Ingestion And Retrieval

AI-HRMS uses a pragmatic local-first RAG strategy for the current
PostgreSQL/pgvector + local embedding setup. The default favors programmatic
filters, deterministic chunking, and auditable retrieval over extra model calls.

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
9. Chunk metadata stored with every new or rebuilt chunk:
   - `body_content`: citation text without document/section prefixes;
   - `section_path`: markdown heading path;
   - `context_prefix`: which prefix parts were included;
   - `chunk_strategy`: strategy/version identifier;
   - `token_budget`, `body_runes`, `overlap_runes`.
10. Hybrid retrieval:
   - vector candidates from pgvector;
   - lexical candidates from PostgreSQL full-text plus `ILIKE`/n-gram patterns;
   - reciprocal rank fusion (RRF) with vector weight `1.0`, lexical weight `0.8`,
     and `k=60`;
   - final citations are filtered by `status`, effective date, scope, and
     sensitivity before ranking.

Example stored chunk:

```text
文档：企鹅互联网科技有限公司样本 HR 手册
章节：新人入职指南 > RAG 引用核验
上文：上一片段的末尾上下文
正文：当前片段内容
```

This improves retrieval without adding another model call during ingestion or
search. Reranking is intentionally not enabled in the current product build.

## Why This Shape

For the current local model, `Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0`, the
priority is to use Qwen3's stronger 1024-dimensional instruction-aware retrieval
without exceeding the local llama.cpp `ctx-size=2048` budget. The project
therefore uses larger, structure-preserving chunks and query instructions, but
still avoids expensive LLM-per-chunk contextualization by default.

The design borrows from current RAG practice:

- Preserve document structure rather than splitting only by fixed length.
- Keep exact lexical retrieval for identifiers, policy names, short Chinese
  queries, and model/provider mismatch cases.
- Add lightweight chunk context so chunks keep document and section meaning.
- Use query instructions because Qwen3 Embedding is instruction-aware and the
  official model guidance recommends scenario-specific retrieval instructions.
- Keep chunk size below the local context budget after prefix and overlap.

## Hybrid Retrieval Contract

The Go API routes normal RAG search through `SearchRAGHybrid` when an embedding
provider is available. If embedding is unavailable, unsafe for external routing,
or returns no query vector, the system falls back to lexical search and returns
that provider metadata instead of pretending vector search succeeded.
If vector lookup returns zero candidates but lexical lookup succeeds, the result
is also reported as `lexical-fallback` with `vector_hit_count=0` metadata.

Candidate sizes are bounded from the user limit:

```text
final citations: request limit, clamped to 1-10
candidateLimit: max(limit * 4, 20)
fusion: score += weight / (60 + rank)
```

Retrieval order is:

1. Apply `published`, effective date, scope, role, employee, and sensitivity
   filters.
2. Retrieve vector candidates only for matching `provider`, `model`, and
   `dimensions`.
3. Retrieve lexical candidates with PostgreSQL `websearch_to_tsquery('simple')`
   plus `ILIKE` patterns for Chinese terms and exact policy names.
4. Deduplicate by `chunk_id`.
5. Fuse rankings with RRF.
6. Write one retrieval log with final citation IDs.

This is hybrid lexical + vector retrieval. It is not branded as BM25 because the
current database setup does not add a BM25 extension such as ParadeDB/pg_search.

## Not Implemented By Default

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
- Reranking: useful after hybrid retrieval, but it is deliberately left as a
  future boundary. A reranker must only receive already authorized candidates,
  must not decide access control, and should be disabled by default.

## Upgrade Path

P1 ingestion upgrade:

1. Add optional semantic splitter for long unstructured articles.
2. Add optional LLM contextualization only for public/internal-safe documents.
3. Store `start_offset`, `end_offset`, parser warnings, and source format when
   richer parsers are introduced.

P2 retrieval upgrade:

1. Evaluate local-only reranker options if the server has enough CPU/RAM.
2. Keep reranker input to top candidates only and preserve scope/sensitivity
   filters before reranking.
3. Log reranker provider/model separately from embedding provider/model.

P3 model upgrade:

1. Evaluate long-context embedding models.
2. Add late chunking only when the embedding service exposes token-level or
   chunked pooling support.

## Parsing Roadmap

Current parsing supports plain text and Markdown headings. Lists and tables are
kept as text inside their section. HTML/PDF/DOCX parsing should be added as
explicit parser adapters instead of hidden string cleanup:

- parser output should include source format, title hierarchy, page/section
  references, parser warnings, and raw/content hashes;
- parser failures should degrade to plain text and surface warnings on the
  ingest job;
- parser version changes should trigger a rebuild of chunks and embeddings.
