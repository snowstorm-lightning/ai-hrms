# Infra

Local infrastructure definitions live here.

Initial plan:

- PostgreSQL with `pgvector` support.
- Redis only when a concrete cache, queue, rate-limit, or fanout use case appears.
