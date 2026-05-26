from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256

from .providers import EmbeddingProvider, FakeEmbeddingProvider


PROMPT_INJECTION_MARKERS = (
    "ignore previous instructions",
    "system prompt",
    "developer message",
    "忽略之前的指令",
)


@dataclass(frozen=True)
class IngestPreview:
    title: str
    chunks: list[str]
    content_hash: str
    embeddings: list[list[float]]
    warnings: list[str]


def sanitize_text(content: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    cleaned = content
    for marker in PROMPT_INJECTION_MARKERS:
        if marker.lower() in cleaned.lower():
            warnings.append(f"removed:{marker}")
            cleaned = cleaned.replace(marker, "[removed]")
    return cleaned.strip(), warnings


def chunk_text(content: str, chunk_size: int = 420) -> list[str]:
    words = content.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for word in words:
        if current and current_len + len(word) + 1 > chunk_size:
            chunks.append(" ".join(current))
            current = []
            current_len = 0
        current.append(word)
        current_len += len(word) + 1
    if current:
        chunks.append(" ".join(current))
    return chunks or ([content] if content else [])


def preview_ingestion(
    title: str,
    content: str,
    embedding_provider: EmbeddingProvider | None = None,
) -> IngestPreview:
    provider = embedding_provider or FakeEmbeddingProvider()
    cleaned, warnings = sanitize_text(content)
    chunks = chunk_text(cleaned)
    return IngestPreview(
        title=title,
        chunks=chunks,
        content_hash=sha256(cleaned.encode("utf-8")).hexdigest(),
        embeddings=provider.embed(chunks),
        warnings=warnings,
    )
