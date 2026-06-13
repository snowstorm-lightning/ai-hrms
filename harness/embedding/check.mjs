const endpoint = trimSlash(process.env.AI_HRMS_EMBEDDING_CHECK_URL || "http://127.0.0.1:8082/v1") + "/embeddings";
const model = process.env.AI_HRMS_EMBEDDING_CHECK_MODEL || process.env.OPENAI_COMPATIBLE_EMBEDDING_MODEL || "Qwen3-Embedding-0.6B-Q8_0";
const apiKey = process.env.AI_HRMS_EMBEDDING_CHECK_API_KEY || process.env.OPENAI_COMPATIBLE_EMBEDDING_API_KEY || "local-no-auth";
const expectedDimensions = Number(process.env.AI_HRMS_EMBEDDING_CHECK_DIMENSIONS || process.env.RAG_EMBEDDING_DIMENSIONS || 1024);
const timeoutMs = Number(process.env.AI_HRMS_EMBEDDING_CHECK_TIMEOUT_MS || 60000);

const sample = "云衡互联网科技有限公司的新员工在 30 天内完成 AI 安全规范、RAG 引用核验和导师复盘。";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  if (!Number.isInteger(expectedDimensions) || expectedDimensions <= 0) {
    throw new Error(`Invalid expected embedding dimensions: ${expectedDimensions}`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [sample],
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding endpoint failed: ${response.status} ${response.statusText} ${redact(body)}`);
  }

  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Embedding endpoint returned no embedding vector.");
  }
  if (vector.length !== expectedDimensions) {
    throw new Error(`Embedding dimensions mismatch: got ${vector.length}, want ${expectedDimensions}.`);
  }
  if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Embedding vector contains non-finite values.");
  }

  console.log(JSON.stringify({
    ok: true,
    endpoint,
    model,
    dimensions: vector.length,
    vectorNotPrinted: true,
  }, null, 2));
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function redact(value) {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .slice(0, 500);
}
