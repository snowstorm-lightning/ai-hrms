from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


READ_TOOLS = {"list_employees", "get_employee", "list_attendance", "rag_search"}


@dataclass(frozen=True)
class ToolPreview:
    accepted: bool
    message: str
    required_risk: str
    result_preview: dict[str, Any]


def preview_tool(tool_name: str, arguments: dict[str, Any]) -> ToolPreview:
    if "user_id" in arguments or "userId" in arguments:
        return ToolPreview(False, "Naked user identity is not accepted.", "blocked", {})
    accepted = tool_name in READ_TOOLS
    return ToolPreview(
        accepted=accepted,
        message="Tool can be previewed through Go gateway." if accepted else "Tool requires Go-side write approval.",
        required_risk="low" if accepted else "high",
        result_preview={"toolName": tool_name},
    )


class GoToolGateway:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token

    def preview(self, tool_name: str, arguments: dict[str, Any], run_id: str | None = None) -> dict[str, Any]:
        response = httpx.post(
            f"{self._base_url}/agent/tools/preview",
            headers={"Authorization": f"Bearer {self._token}"},
            json={"runId": run_id, "toolName": tool_name, "arguments": arguments},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["data"]
