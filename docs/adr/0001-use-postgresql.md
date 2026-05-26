# ADR 0001: Use PostgreSQL

## Status

Accepted

## Context

The source project uses MySQL. AI-HRMS needs strong relational modeling and future RAG support.

## Decision

Use PostgreSQL as the primary database. Plan for `pgvector` when RAG work begins.

## Consequences

- Source SQL must be remodeled instead of copied directly.
- Database migrations target PostgreSQL.
- RAG can start in the same database before a dedicated vector service is needed.
