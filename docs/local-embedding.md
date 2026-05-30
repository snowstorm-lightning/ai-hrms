# Local Embedding Deployment

AI-HRMS keeps LLM generation and RAG vectors separate:

- LLM chat: DeepSeek through `AI_CHAT_PROVIDER=deepseek` and `DEEPSEEK_*`.
- Embedding: OpenAI-compatible `/v1/embeddings`, optionally self-hosted.
- Vector storage: PostgreSQL/pgvector through the Go API.

For a 4-core CPU, 4 GB memory, and 40 GB system disk server, use the Qwen3 GGUF
embedding profile:

```text
Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0
runtime: llama.cpp server
dimensions: 1024
ctx-size: 2048
threads: 2
memory limit: 1.5-2 GB
```

Do not start with 4B/8B embedding or reranker models on this machine. They
increase memory, disk, and first-pull time without improving the assignment demo
path enough to justify the risk.

## Docker Compose

The optional `embedding` profile starts llama.cpp as an OpenAI-compatible local
embedding endpoint:

```bash
docker compose --profile embedding --env-file infra/.env -f infra/compose.yaml up -d embedding
```

Recommended `infra/.env` values:

```dotenv
LOCAL_EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0
LOCAL_EMBEDDING_API_KEY=local-no-auth
LOCAL_EMBEDDING_CTX_SIZE=2048
LOCAL_EMBEDDING_THREADS=2
LOCAL_EMBEDDING_PARALLEL=1
LOCAL_EMBEDDING_UBATCH_SIZE=512
LOCAL_EMBEDDING_CACHE_RAM=0
LOCAL_EMBEDDING_MEMORY_LIMIT=2g
EMBEDDING_PORT=8082

AI_EMBEDDING_PROVIDER=local-openai-compatible
OPENAI_COMPATIBLE_EMBEDDING_API_KEY=local-no-auth
OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=http://embedding:80/v1
OPENAI_COMPATIBLE_EMBEDDING_MODEL=Qwen3-Embedding-0.6B-Q8_0
RAG_EMBEDDING_DIMENSIONS=1024
```

For native local development outside Docker, use:

```dotenv
OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=http://127.0.0.1:8082/v1
```

`OPENAI_COMPATIBLE_EMBEDDING_BASE_URL` is the base URL. The code appends
`/embeddings`, so do not set it to a URL that already ends in `/embeddings`.

## Harness

After the embedding service is up, run:

```bash
AI_HRMS_EMBEDDING_CHECK_URL=http://127.0.0.1:8082/v1 \
AI_HRMS_EMBEDDING_CHECK_API_KEY=local-no-auth \
AI_HRMS_EMBEDDING_CHECK_MODEL=Qwen3-Embedding-0.6B-Q8_0 \
AI_HRMS_EMBEDDING_CHECK_DIMENSIONS=1024 \
npm run embedding:check
```

The harness validates endpoint compatibility and vector dimensions without
printing vectors, keys, or real HR data.

Passing this harness proves the embedding endpoint works. It does not prove
existing PostgreSQL vectors were rebuilt. If you change provider, model, or
dimension, re-ingest or regenerate RAG documents before expecting vector-first
search to hit old documents.

## Safety Boundary

Use `local-openai-compatible` for the local llama.cpp service. It still uses the
OpenAI-compatible protocol, but the Go API treats it as local processing for
embedding risk gates. Cloud embedding providers should remain
`openai-compatible`, where internal/restricted/high-impact text is blocked
before it leaves the system boundary.
