# Python AI Constraints

## Stack

- Use Python for AI agent and RAG-specific code.
- Manage Python dependencies and lockfiles with `uv`.

## Boundary

- The Python service must call Go-owned tools or APIs for HRMS business data.
- It must not bypass Go authorization by directly querying HRMS tables.
- It must not accept a naked `user_id` as trusted identity.
- Provider failures must not bypass Go audit or scope checks.

## Provider Abstraction

Keep chat, embedding, rerank, vision, and parser providers swappable between cloud, local, and fake adapters.
