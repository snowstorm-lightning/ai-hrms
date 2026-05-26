#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import os
import urllib.error
import urllib.request


BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080/api").rstrip("/")


def encode_body(body: object | None) -> bytes | None:
    if body is None:
        return None
    if isinstance(body, str):
        return body.encode("utf-8")
    return json.dumps(body).encode("utf-8")


def request(
    method: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    body: object | None = None,
    expect_json: bool = True,
) -> tuple[object, urllib.response.addinfourl]:
    request_headers = {"Accept": "application/json"}
    request_headers.update(headers or {})
    data = encode_body(body)
    if data is not None:
        request_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=request_headers,
        method=method.upper(),
    )
    response = urllib.request.urlopen(req, timeout=10)
    raw = response.read()
    if not expect_json:
        return raw, response

    content_type = response.headers.get("Content-Type", "")
    if "application/json" not in content_type:
        raise AssertionError(f"Expected JSON response for {path}, got {content_type}")
    return json.loads(raw.decode("utf-8")), response


def api_json(
    path: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: object | None = None,
) -> dict[str, object]:
    payload, _ = request(method, path, headers=headers, body=body)
    if not isinstance(payload, dict):
        raise AssertionError(f"Expected object response for {path}")
    return payload


def assert_api_rejected(
    path: str,
    expected_status: set[int],
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: object | None = None,
) -> None:
    try:
        api_json(path, method=method, headers=headers, body=body)
    except urllib.error.HTTPError as exc:
        if exc.code in expected_status:
            return
        detail = exc.read().decode("utf-8", errors="replace")
        raise AssertionError(f"Expected {path} to fail with {sorted(expected_status)}, got {exc.code}: {detail}") from exc
    raise AssertionError(f"Expected {path} to be rejected")


def assert_success(payload: dict[str, object], path: str) -> None:
    if payload.get("success") is not True:
        raise AssertionError(f"API smoke failed for {path}")


def auth_headers(mobile: str, password: str = "password") -> dict[str, str]:
    login = api_json("/auth/login", method="POST", body={"mobile": mobile, "password": password})
    token = login.get("data", {}).get("token") if isinstance(login.get("data"), dict) else None
    if not token:
        raise AssertionError(f"Login for {mobile} did not return a token")
    return {"Authorization": f"Bearer {token}"}


def get_data(payload: dict[str, object], path: str) -> object:
    if "data" not in payload:
        raise AssertionError(f"{path} did not return data")
    return payload["data"]


def main() -> None:
    health = api_json("/health")
    if get_data(health, "/health").get("status") != "ok":  # type: ignore[union-attr]
        raise AssertionError("Health check failed")

    headers = auth_headers("123")

    paths = [
        "/profile",
        "/legal-entities",
        "/org-units",
        "/roles",
        "/capabilities",
        "/users",
        "/employees",
        "/attendance",
        "/messages",
        "/rag/sources",
        "/rag/documents",
        "/learning/courses",
        "/learning/enrollments",
        "/agent/runs",
        "/audit/events",
        "/visual-copilot/events",
    ]
    for path in paths:
        assert_success(api_json(path, headers=headers), path)

    bindings = api_json("/users/00000000-0000-0000-0000-000000000302/role-bindings", headers=headers)
    binding_data = get_data(bindings, "role bindings")
    if not isinstance(binding_data, list) or len(binding_data) < 1:
        raise AssertionError("Expected seeded role bindings")
    replaced_bindings = api_json(
        "/users/00000000-0000-0000-0000-000000000302/role-bindings",
        method="PUT",
        headers=headers,
        body={"bindings": binding_data},
    )
    assert_success(replaced_bindings, "role binding replacement")

    for path, label in [("/employees/export", "Employee"), ("/attendance/export", "Attendance")]:
        csv_body, response = request("GET", path, headers=headers, expect_json=False)
        content_type = response.headers.get("Content-Type", "")
        if response.status != 200 or "text/csv" not in content_type or len(csv_body) < 10:  # type: ignore[arg-type]
            raise AssertionError(f"{label} export did not return CSV content")

    entity_headers = auth_headers("100111")
    entity_profile = api_json("/profile", headers=entity_headers)
    profile_data = get_data(entity_profile, "/profile")
    if profile_data.get("mobile") != "100111":  # type: ignore[union-attr]
        raise AssertionError("Scoped profile returned the wrong user")

    assert_success(
        api_json("/employees/00000000-0000-0000-0000-000000000402", headers=entity_headers),
        "scoped employee read",
    )

    entity_legal_entities = api_json("/legal-entities", headers=entity_headers)
    legal_entity_data = get_data(entity_legal_entities, "/legal-entities")
    if any(entity.get("id") == "00000000-0000-0000-0000-000000000103" for entity in legal_entity_data):  # type: ignore[union-attr]
        raise AssertionError("Scoped legal entity list leaked an unauthorized legal entity")

    assert_api_rejected("/users", {403}, headers=entity_headers)
    assert_api_rejected("/roles", {403}, headers=entity_headers)
    assert_api_rejected("/legal-entities", {403}, method="POST", headers=entity_headers, body={})
    assert_api_rejected("/employees/00000000-0000-0000-0000-000000000403", {404}, headers=entity_headers)
    assert_api_rejected(
        "/attendance",
        {404},
        method="POST",
        headers=entity_headers,
        body={"employeeId": "00000000-0000-0000-0000-000000000403", "attendanceStatus": 1},
    )
    assert_api_rejected(
        "/attendance/00000000-0000-0000-0000-000000000601/checkout",
        {404},
        method="PUT",
        headers=entity_headers,
    )

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    rag_source = api_json(
        "/rag/sources",
        method="POST",
        headers=headers,
        body={"sourceType": "url", "name": f"Harness source {timestamp}", "uri": "https://example.com/hr-policy"},
    )
    rag_source_data = get_data(rag_source, "/rag/sources")
    source_id = rag_source_data.get("id")  # type: ignore[union-attr]
    if not source_id:
        raise AssertionError("RAG source creation failed")

    rag_document = api_json(
        "/rag/documents",
        method="POST",
        headers=headers,
        body={
            "sourceId": source_id,
            "title": "Harness onboarding policy",
            "version": "v1",
            "status": "published",
            "trustLevel": "official",
            "sensitivity": "normal",
            "content": "Onboarding employees must finish policy learning in 7 days and manager review in 30 days.",
            "scopes": [{"scopeType": "global", "includeDescendants": True}],
        },
    )
    if not get_data(rag_document, "/rag/documents").get("id"):  # type: ignore[union-attr]
        raise AssertionError("RAG document creation failed")

    ingest_job = api_json(
        "/rag/ingest-jobs",
        method="POST",
        headers=headers,
        body={
            "jobType": "ingest",
            "title": "Harness direct ingestion",
            "content": "Direct ingestion supports uploaded text, local directory sources, and URL sources through the same job API.",
            "scopes": [{"scopeType": "global", "includeDescendants": True}],
        },
    )
    if not get_data(ingest_job, "/rag/ingest-jobs").get("documentId"):  # type: ignore[union-attr]
        raise AssertionError("RAG ingestion job should materialize a document")

    rag_search = api_json("/rag/search", method="POST", headers=entity_headers, body={"query": "Onboarding", "limit": 5})
    if len(get_data(rag_search, "/rag/search").get("citations", [])) < 1:  # type: ignore[union-attr]
        raise AssertionError("Scoped RAG search should return citations")

    chat = api_json(
        "/ai/chat",
        method="POST",
        headers=entity_headers,
        body={"message": "What should onboarding finish in 7 days?"},
    )
    if len(get_data(chat, "/ai/chat").get("citations", [])) < 1:  # type: ignore[union-attr]
        raise AssertionError("AI chat did not return citation-grounded response")

    run = api_json(
        "/agent/runs",
        method="POST",
        headers=headers,
        body={"runType": "data_quality", "prompt": "Check assignment data", "riskLevel": "low"},
    )
    run_id = get_data(run, "/agent/runs").get("id")  # type: ignore[union-attr]
    if not run_id:
        raise AssertionError("Agent run creation failed")

    tool_preview = api_json(
        "/agent/tools/preview",
        method="POST",
        headers=headers,
        body={"runId": run_id, "toolName": "list_employees", "arguments": {}},
    )
    if get_data(tool_preview, "/agent/tools/preview").get("accepted") is not True:  # type: ignore[union-attr]
        raise AssertionError("Read-only agent tool preview should be accepted")
    assert_api_rejected(
        "/agent/tools/preview",
        {400},
        method="POST",
        headers=headers,
        body={
            "userId": "00000000-0000-0000-0000-000000000301",
            "toolName": "list_employees",
            "arguments": {},
        },
    )

    visual_allowed_body = {
        "route": "/app/employees",
        "viewport": {"width": 1280, "height": 720, "scrollX": 0, "scrollY": 0},
        "dom": [{"kind": "table-row", "objectType": "employee", "objectId": "00000000-0000-0000-0000-000000000402"}],
        "regions": [
            {
                "id": "r1",
                "mode": "rect",
                "rect": {"x": 1, "y": 1, "width": 20, "height": 20, "dpr": 1},
                "businessRefs": [
                    {"type": "employee", "id": "00000000-0000-0000-0000-000000000402", "label": "Average"}
                ],
            }
        ],
        "instruction": "Explain this employee row",
    }
    visual = api_json("/visual-copilot/suggestions", method="POST", headers=entity_headers, body=visual_allowed_body)
    visual_event = get_data(visual, "/visual-copilot/suggestions").get("event", {})  # type: ignore[union-attr]
    if not visual_event.get("id"):
        raise AssertionError("Visual Copilot suggestion should create an event")

    visual_rejected_body = {
        "route": "/app/employees",
        "viewport": {"width": 1280, "height": 720, "scrollX": 0, "scrollY": 0},
        "dom": [],
        "regions": [
            {
                "id": "r2",
                "mode": "rect",
                "rect": {"x": 1, "y": 1, "width": 20, "height": 20, "dpr": 1},
                "businessRefs": [
                    {"type": "employee", "id": "00000000-0000-0000-0000-000000000403", "label": "simon"}
                ],
            }
        ],
        "instruction": "Explain unauthorized employee",
    }
    assert_api_rejected(
        "/visual-copilot/suggestions",
        {403},
        method="POST",
        headers=entity_headers,
        body=visual_rejected_body,
    )

    audit = api_json("/audit/events", headers=headers)
    if get_data(audit, "/audit/events").get("total", 0) < 1:  # type: ignore[union-attr]
        raise AssertionError("Expected audit events after AI/RAG/Visual operations")

    print("API smoke check passed.")


if __name__ == "__main__":
    main()
