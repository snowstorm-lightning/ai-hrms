# Embedding Harness

Validates an OpenAI-compatible embedding endpoint without printing vector values
or API keys.

Default local llama.cpp/Qwen3 target:

```bash
AI_HRMS_EMBEDDING_CHECK_URL=http://127.0.0.1:8082/v1 \
AI_HRMS_EMBEDDING_CHECK_API_KEY=local-no-auth \
AI_HRMS_EMBEDDING_CHECK_MODEL=Qwen3-Embedding-0.6B-Q8_0 \
AI_HRMS_EMBEDDING_CHECK_DIMENSIONS=1024 \
./harness/embedding/check.sh
```

The check posts one fictional AI-HRMS sample sentence to `/v1/embeddings`,
verifies a finite numeric vector, and verifies the dimension count.
