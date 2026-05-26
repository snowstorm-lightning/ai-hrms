from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Protocol


@dataclass(frozen=True)
class ChatRequest:
    message: str
    citations: list[dict[str, str]]


@dataclass(frozen=True)
class ChatResponse:
    message: str
    provider: str
    model: str
    citations: list[dict[str, str]]


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
