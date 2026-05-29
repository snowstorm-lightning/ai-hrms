from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import os
from typing import Protocol

import httpx


@dataclass(frozen=True)
class ChatRequest:
    message: str
    citations: list[dict[str, object]]


@dataclass(frozen=True)
class ChatResponse:
    message: str
    provider: str
    model: str
    citations: list[dict[str, object]]


@dataclass(frozen=True)
class AIProviderSettings:
    chat_provider: str
    deepseek_api_key: str
    deepseek_base_url: str
    deepseek_chat_model: str
    deepseek_reasoning_effort: str
    deepseek_timeout_seconds: float
    embedding_provider: str
    embedding_api_key: str
    embedding_base_url: str
    embedding_model: str
    embedding_dimensions: int


class ProviderConfigurationError(RuntimeError):
    pass


class ProviderCallError(RuntimeError):
    pass


def _env_text(key: str, fallback: str = "") -> str:
    value = os.getenv(key)
    if value is None:
        return fallback
    value = value.strip()
    return value if value else fallback


def _env_float(key: str, fallback: float) -> float:
    try:
        value = float(_env_text(key, ""))
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def _env_int(key: str, fallback: int) -> int:
    try:
        value = int(_env_text(key, ""))
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def _base_url(value: str) -> str:
    return value.rstrip("/")


def load_ai_provider_settings() -> AIProviderSettings:
    return AIProviderSettings(
        chat_provider=_env_text("AI_CHAT_PROVIDER", "fake").lower(),
        deepseek_api_key=_env_text("DEEPSEEK_API_KEY", ""),
        deepseek_base_url=_base_url(_env_text("DEEPSEEK_BASE_URL", "https://api.deepseek.com")),
        deepseek_chat_model=_env_text("DEEPSEEK_CHAT_MODEL", "deepseek-v4-flash"),
        deepseek_reasoning_effort=_env_text("DEEPSEEK_REASONING_EFFORT", "high"),
        deepseek_timeout_seconds=_env_float("DEEPSEEK_TIMEOUT_SECONDS", 30.0),
        embedding_provider=_env_text("AI_EMBEDDING_PROVIDER", "fake").lower(),
        embedding_api_key=_env_text("OPENAI_COMPATIBLE_EMBEDDING_API_KEY", ""),
        embedding_base_url=_base_url(_env_text("OPENAI_COMPATIBLE_EMBEDDING_BASE_URL", "")),
        embedding_model=_env_text("OPENAI_COMPATIBLE_EMBEDDING_MODEL", ""),
        embedding_dimensions=_env_int("RAG_EMBEDDING_DIMENSIONS", 8),
    )


class ChatProvider(Protocol):
    provider: str
    model: str

    def chat(self, request: ChatRequest) -> ChatResponse:
        ...


class EmbeddingProvider(Protocol):
    provider: str
    model: str
    dimensions: int

    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class FakeChatProvider:
    provider = "fake"
    model = "deterministic-v1"

    def chat(self, request: ChatRequest) -> ChatResponse:
        if not request.citations:
            message = "No scoped citation was supplied, so the agent refuses to answer."
        else:
            message = "Answer generated from scoped citations."
        return ChatResponse(
            message=message,
            provider=self.provider,
            model=self.model,
            citations=request.citations,
        )


class FakeEmbeddingProvider:
    provider = "fake"
    model = "deterministic-v1"
    dimensions = 8

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(text) for text in texts]

    def _one(self, text: str) -> list[float]:
        digest = sha256(text.encode("utf-8")).digest()
        return [round(digest[index] / 255, 4) for index in range(self.dimensions)]


class DeepSeekChatProvider:
    provider = "deepseek"

    def __init__(self, settings: AIProviderSettings):
        if not settings.deepseek_api_key:
            raise ProviderConfigurationError("DeepSeek API key is not configured.")
        if not settings.deepseek_base_url:
            raise ProviderConfigurationError("DeepSeek base URL is not configured.")
        self.model = settings.deepseek_chat_model
        self._api_key = settings.deepseek_api_key
        self._base_url = settings.deepseek_base_url
        self._timeout = settings.deepseek_timeout_seconds
        self._reasoning_effort = settings.deepseek_reasoning_effort

    def chat(self, request: ChatRequest) -> ChatResponse:
        try:
            response = httpx.post(
                f"{self._base_url}/chat/completions",
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are the AI-HRMS agent boundary. Answer only from supplied scoped citations. "
                                "For HR decisions with high employee impact, explain evidence and require human review. "
                                "Do not produce automated hiring, firing, compensation, promotion, or elimination decisions."
                            ),
                        },
                        {
                            "role": "user",
                            "content": _chat_user_payload(request),
                        },
                    ],
                    "reasoning_effort": self._reasoning_effort,
                },
            )
            response.raise_for_status()
            payload = response.json()
            message = str(payload["choices"][0]["message"]["content"]).strip()
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderCallError("DeepSeek chat completion failed.") from exc
        if not message:
            raise ProviderCallError("DeepSeek chat completion returned an empty message.")
        return ChatResponse(message=message, provider=self.provider, model=self.model, citations=request.citations)


class OpenAICompatibleEmbeddingProvider:
    provider = "openai-compatible"

    def __init__(self, settings: AIProviderSettings):
        if not settings.embedding_api_key:
            raise ProviderConfigurationError("Embedding API key is not configured.")
        if not settings.embedding_base_url:
            raise ProviderConfigurationError("Embedding base URL is not configured.")
        if not settings.embedding_model:
            raise ProviderConfigurationError("Embedding model is not configured.")
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions
        self._api_key = settings.embedding_api_key
        self._base_url = settings.embedding_base_url
        self._timeout = settings.deepseek_timeout_seconds

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = httpx.post(
                f"{self._base_url}/embeddings",
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": self.model, "input": texts},
            )
            response.raise_for_status()
            payload = response.json()
            rows = payload["data"]
            rows = sorted(rows, key=lambda item: item.get("index", 0))
            embeddings = [[float(value) for value in row["embedding"]] for row in rows]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise ProviderCallError("Embedding request failed.") from exc
        if len(embeddings) != len(texts):
            raise ProviderCallError("Embedding response count did not match input count.")
        if self.dimensions and any(len(vector) != self.dimensions for vector in embeddings):
            raise ProviderCallError("Embedding response dimensions did not match configuration.")
        return embeddings


def build_chat_provider(settings: AIProviderSettings | None = None) -> ChatProvider:
    settings = settings or load_ai_provider_settings()
    if settings.chat_provider == "deepseek":
        return DeepSeekChatProvider(settings)
    if settings.chat_provider == "fake":
        return FakeChatProvider()
    raise ProviderConfigurationError("Unsupported chat provider.")


def build_embedding_provider(settings: AIProviderSettings | None = None) -> EmbeddingProvider:
    settings = settings or load_ai_provider_settings()
    if settings.embedding_provider in {"openai-compatible", "openai_compatible"}:
        return OpenAICompatibleEmbeddingProvider(settings)
    if settings.embedding_provider == "fake":
        return FakeEmbeddingProvider()
    raise ProviderConfigurationError("Unsupported embedding provider.")


def _chat_user_payload(request: ChatRequest) -> str:
    citation_lines = []
    for index, citation in enumerate(request.citations, start=1):
        title = citation.get("title", "Untitled")
        snippet = citation.get("snippet", "")
        citation_lines.append(f"[{index}] {title}: {snippet}")
    citations = "\n".join(citation_lines) if citation_lines else "No scoped citations were supplied."
    return f"Question:\n{request.message}\n\nScoped citations:\n{citations}"
