# Python AI Constraints

## Stack

- Use Python for AI agent and RAG-specific code.
- Manage Python dependencies and lockfiles with `uv`.

## Boundary

- The Python service must call Go-owned tools or APIs for HRMS business data.
- It must not bypass Go authorization by directly querying HRMS tables.
- It must not accept a naked `user_id` as trusted identity.
- Provider failures must not bypass Go audit or scope checks.
- Provider keys belong in local env/deployment secrets for the Python agent, not in frontend code.

## Provider Abstraction

Keep chat, embedding, rerank, vision, and parser providers swappable between cloud, local, and fake adapters.

Current production adapters:

- DeepSeek OpenAI-compatible Chat Completions for chat.
- OpenAI-compatible embedding API for RAG vectors.
- LangGraph for workflow preview demos that still route through Go for auth and audit.
