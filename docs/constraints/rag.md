# RAG Constraints

## Direction

Use PostgreSQL plus `pgvector` for the first RAG storage path.

## Access Control

RAG retrieval must apply the same organization scope rules as normal business APIs.

## Document Scope

RAG documents can be global, legal-entity scoped, or organization-unit scoped.

## Runtime Rules

- Filter by scope, document status, effective dates, and sensitivity before returning citations.
- Do not index HR PII by default.
- Clean prompt-injection text during ingestion.
- Log retrievals with query, resolved scope, citations, and refusal reason.
- First connector path covers direct text upload, HTTP(S) URL fetch, and local file/directory reads.
- Local file/directory reads require `AI_HRMS_INGEST_ROOT` and must stay inside that root.
