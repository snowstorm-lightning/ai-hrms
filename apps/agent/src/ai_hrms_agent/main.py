from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

from .connectors import ConnectorPreview, preview_connector
from .gateway import preview_tool
from .ingestion import IngestPreview, preview_ingestion
from .providers import ChatRequest, FakeChatProvider


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
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)


class ChatPreviewRequest(BaseModel):
    message: str = Field(min_length=1)
    citations: list[dict[str, str]] = Field(default_factory=list)


class ConnectorPreviewRequest(BaseModel):
    source_type: str = Field(min_length=1)
    uri: str = ""
    content: str = ""


def create_app() -> FastAPI:
    app = FastAPI(title="AI-HRMS Agent", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

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
        response = FakeChatProvider().chat(ChatRequest(message=request.message, citations=request.citations))
        return {
            "message": response.message,
            "provider": response.provider,
            "model": response.model,
            "citations": response.citations,
        }

    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("ai_hrms_agent.main:app", host="127.0.0.1", port=8090, reload=True)
