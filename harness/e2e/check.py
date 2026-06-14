#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.request


BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8080/api").rstrip("/")


def api_json(
    path: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: object | None = None,
) -> dict[str, object]:
    request_headers = {"Accept": "application/json"}
    request_headers.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=request_headers,
        method=method.upper(),
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def data(payload: dict[str, object]) -> object:
    return payload["data"]


def main() -> None:
    admin_login = api_json("/auth/login", method="POST", body={"mobile": "123", "password": "12345678900"})
    token = data(admin_login)["token"]  # type: ignore[index]
    admin_headers = {"Authorization": f"Bearer {token}"}

    profile = api_json("/profile", headers=admin_headers)
    if data(profile)["mobile"] != "123":  # type: ignore[index]
        raise AssertionError("E2E profile failed")

    entities = api_json("/legal-entities", headers=admin_headers)
    org_units = api_json("/org-units", headers=admin_headers)
    employees = api_json("/employees", headers=admin_headers)
    attendance = api_json("/attendance", headers=admin_headers)
    messages = api_json("/messages", headers=admin_headers)
    learning = api_json("/learning/courses", headers=admin_headers)
    knowledge = api_json("/rag/documents", headers=admin_headers)

    if len(data(entities)) < 1 or len(data(org_units)) < 1 or data(employees)["total"] < 1:  # type: ignore[arg-type,index]
        raise AssertionError("E2E HRMS data workflow failed")
    if data(attendance).get("total") is None or data(messages).get("total") is None:  # type: ignore[union-attr]
        raise AssertionError("E2E activity workflow failed")
    if data(learning)["total"] < 1 or data(knowledge)["total"] < 1:  # type: ignore[index]
        raise AssertionError("E2E AI-native data workflow failed")

    ai = api_json("/ai/chat", method="POST", headers=admin_headers, body={"message": "Onboarding"})
    if len(data(ai).get("citations", [])) < 1:  # type: ignore[union-attr]
        raise AssertionError("E2E AI chat should include citations")

    print("E2E check passed.")


if __name__ == "__main__":
    main()
