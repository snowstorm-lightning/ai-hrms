# Agent App

Python AI agent service managed by `uv`.

Target:

- DeepSeek/OpenAI-compatible chat boundary.
- OpenAI-compatible embedding boundary for PostgreSQL/pgvector RAG.
- LangGraph workflow demo for human-agent risk, context, preview, and review gates.
- Tool, ingestion, connector, and provider previews.
- No direct bypass of Go business authorization.

## DeepSeek / OpenAI-Compatible Environment

The agent reads provider configuration from environment variables. Leave
`AI_CHAT_PROVIDER=fake` to avoid external calls.

```bash
export AI_CHAT_PROVIDER=deepseek
export AI_HRMS_AGENT_SERVICE_TOKEN='<same-token-as-go-api>'
export DEEPSEEK_API_KEY='<your-deepseek-api-key>'
export DEEPSEEK_BASE_URL='https://api.deepseek.com'
export DEEPSEEK_CHAT_MODEL='deepseek-v4-flash'
export DEEPSEEK_REASONING_EFFORT='high'
export DEEPSEEK_TIMEOUT_SECONDS=30
```

RAG vectors are stored in PostgreSQL/pgvector. Configure embeddings separately
when replacing deterministic embeddings:

```bash
export AI_EMBEDDING_PROVIDER=openai-compatible
export AI_HRMS_AGENT_SERVICE_TOKEN='<same-token-as-go-api>'
export OPENAI_COMPATIBLE_EMBEDDING_API_KEY='<your-embedding-api-key>'
export OPENAI_COMPATIBLE_EMBEDDING_BASE_URL='<embedding-base-url>'
export OPENAI_COMPATIBLE_EMBEDDING_MODEL='<embedding-model>'
export RAG_EMBEDDING_DIMENSIONS='<embedding-dimensions>'
```

Check what the running agent sees without printing secrets:

```bash
curl http://127.0.0.1:8090/config/ai
```

`AI_HRMS_AGENT_SERVICE_TOKEN` is required whenever chat or embedding providers
are not `fake`. Internal calls must include `X-AI-HRMS-Agent-Token`; `/health`
remains open for container health checks. URL connector preview is disabled by
default and should normally be handled by the Go ingestion boundary.
