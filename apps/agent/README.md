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
export DEEPSEEK_API_KEY='<your-deepseek-api-key>'
export DEEPSEEK_BASE_URL='https://api.deepseek.com'
export DEEPSEEK_CHAT_MODEL='deepseek-v4-flash'
export DEEPSEEK_REASONING_EFFORT='high'
export DEEPSEEK_TIMEOUT_SECONDS=30
```

RAG vectors are stored in PostgreSQL/pgvector. Configure embeddings separately
when replacing deterministic embeddings:

```bash
export AI_EMBEDDING_PROVIDER=fake
export OPENAI_COMPATIBLE_EMBEDDING_API_KEY=''
export OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=''
export OPENAI_COMPATIBLE_EMBEDDING_MODEL=''
export RAG_EMBEDDING_DIMENSIONS=8
```

Check what the running agent sees without printing secrets:

```bash
curl http://127.0.0.1:8090/config/ai
```

If `AI_HRMS_AGENT_SERVICE_TOKEN` is set, internal calls must include
`X-AI-HRMS-Agent-Token`. `/health` remains open for container health checks.
