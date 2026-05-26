# ADR 0004: Defer Redis Until Needed

## Status

Accepted

## Context

Redis can help with cache, rate limiting, queues, and fanout, but the first phase can run on PostgreSQL.

## Decision

Do not make Redis a core dependency for MVP.

## Consequences

- Local setup is simpler.
- Redis can be added for concrete cases such as AI rate limiting, background queues, or multi-instance notifications.
