from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .connectors import ConnectorPreview, preview_connector
from .gateway import preview_tool
from .ingestion import IngestPreview, preview_ingestion
from .providers import (
    ChatRequest,
    ProviderCallError,
    ProviderConfigurationError,
    build_chat_provider,
    build_embedding_provider,
    load_ai_provider_settings,
)
from .workflows import run_hr_workflow


class ToolPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delegated_context: dict[str, object] = Field(default_factory=dict)
    tool_name: str = Field(min_length=1)
    arguments: dict[str, object] = Field(default_factory=dict)


class ToolPreviewResponse(BaseModel):
    accepted: bool
    message: str
    required_risk: str
    result_preview: dict[str, object] = Field(default_factory=dict)


class IngestPreviewRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=80_000)


class ChatPreviewRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6_000)
    citations: list[dict[str, object]] = Field(default_factory=list, max_length=12)


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class WorkflowDemoRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=2_000)
    context: list[str] = Field(default_factory=list, max_length=20)


class ConnectorPreviewRequest(BaseModel):
    source_type: str = Field(min_length=1, max_length=60)
    uri: str = Field(default="", max_length=2_000)
    content: str = Field(default="", max_length=80_000)


def _citation_payload_size(citations: list[dict[str, object]]) -> int:
    total = 0
    for citation in citations:
        total += len(str(citation.get("title") or ""))
        total += len(str(citation.get("snippet") or ""))
    return total


def _validate_agent_boundary() -> None:
    settings = load_ai_provider_settings()
    token = os.getenv("AI_HRMS_AGENT_SERVICE_TOKEN", "").strip()
    if token:
        return
    if settings.chat_provider != "fake" or settings.embedding_provider != "fake":
        raise RuntimeError(
            "AI_HRMS_AGENT_SERVICE_TOKEN is required when chat or embedding providers are not fake."
        )


def create_app() -> FastAPI:
    _validate_agent_boundary()
    app = FastAPI(title="AI-HRMS Agent", version="0.1.0")

    @app.middleware("http")
    async def service_token_guard(request: Request, call_next):
        token = os.getenv("AI_HRMS_AGENT_SERVICE_TOKEN", "").strip()
        if token and request.url.path != "/health":
            if request.headers.get("X-AI-HRMS-Agent-Token") != token:
                return JSONResponse(status_code=401, content={"detail": "Agent service token is required."})
        return await call_next(request)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/config/ai")
    def ai_config() -> dict[str, object]:
        settings = load_ai_provider_settings()
        return {
            "chatProvider": settings.chat_provider,
            "deepseekBaseURL": settings.deepseek_base_url,
            "deepseekChatModel": settings.deepseek_chat_model,
            "deepseekReasoningEffort": settings.deepseek_reasoning_effort,
            "deepseekAPIKeyConfigured": bool(settings.deepseek_api_key),
            "embeddingProvider": settings.embedding_provider,
            "embeddingAPIKeyConfigured": bool(settings.embedding_api_key),
            "embeddingBaseURLConfigured": bool(settings.embedding_base_url),
            "embeddingModel": settings.embedding_model,
            "embeddingDimensions": settings.embedding_dimensions,
        }

    @app.post("/tools/preview")
    def tool_preview(request: ToolPreviewRequest) -> ToolPreviewResponse:
        preview = preview_tool(request.tool_name, request.arguments)
        return ToolPreviewResponse(
            accepted=preview.accepted,
            message=preview.message,
            required_risk=preview.required_risk,
            result_preview=preview.result_preview,
        )

    @app.post("/ingestion/preview")
    def ingestion_preview(request: IngestPreviewRequest) -> IngestPreview:
        return preview_ingestion(request.title, request.content)

    @app.post("/connectors/preview")
    def connector_preview(request: ConnectorPreviewRequest) -> ConnectorPreview:
        return preview_connector(request.source_type, request.uri, request.content)

    @app.post("/chat/preview")
    def chat_preview(request: ChatPreviewRequest) -> dict[str, object]:
        if any(len(str(citation.get("snippet") or "")) > 2_000 for citation in request.citations):
            raise HTTPException(status_code=413, detail="Each citation snippet must be at most 2000 characters.")
        if _citation_payload_size(request.citations) > 9_000:
            raise HTTPException(status_code=413, detail="Citation payload is too large for a bounded chat preview.")
        try:
            provider = build_chat_provider()
            response = provider.chat(ChatRequest(message=request.message, citations=request.citations))
        except ProviderConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ProviderCallError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {
            "message": response.message,
            "provider": response.provider,
            "model": response.model,
            "citations": response.citations,
        }

    @app.post("/embeddings")
    def embeddings(request: EmbeddingRequest) -> dict[str, object]:
        texts = [text.strip() for text in request.texts if text.strip()]
        if any(len(text) > 8_000 for text in texts):
            raise HTTPException(status_code=413, detail="Each embedding text must be at most 8000 characters.")
        if not texts:
            raise HTTPException(status_code=400, detail="At least one non-empty text is required.")
        try:
            provider = build_embedding_provider()
            vectors = provider.embed(texts)
        except ProviderConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ProviderCallError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {
            "provider": provider.provider,
            "model": provider.model,
            "dimensions": provider.dimensions,
            "embeddings": vectors,
        }

    @app.post("/workflows/langgraph/demo")
    def langgraph_demo(request: WorkflowDemoRequest) -> dict[str, object]:
        return run_hr_workflow(request.goal, request.context)

    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("ai_hrms_agent.main:app", host="127.0.0.1", port=8090, reload=True)
