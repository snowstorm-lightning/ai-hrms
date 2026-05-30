from __future__ import annotations

import os
import re
import socket
from dataclasses import dataclass
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx


TEXT_EXTENSIONS = {".txt", ".md", ".html", ".htm"}


@dataclass(frozen=True)
class ConnectorPreview:
    source_type: str
    title: str
    content: str
    warnings: list[str]


def preview_connector(source_type: str, uri: str, content: str = "") -> ConnectorPreview:
    if source_type == "upload":
        if not content.strip():
            raise ValueError("upload connector requires content")
        return ConnectorPreview(source_type, "Uploaded content", content.strip(), [])
    if source_type == "url":
        return _preview_url(uri)
    if source_type == "directory":
        return _preview_local(uri)
    if source_type == "connector":
        return ConnectorPreview(source_type, uri or "Enterprise connector", "", ["adapter_not_configured"])
    raise ValueError("unsupported connector type")


def _preview_url(uri: str) -> ConnectorPreview:
    if os.environ.get("AI_HRMS_ENABLE_AGENT_URL_CONNECTOR", "").lower() not in {"1", "true", "yes", "on"}:
        raise ValueError("url connector is disabled in the agent; use the Go API ingestion boundary")
    parsed = urlparse(uri)
    _validate_public_http_url(parsed)
    url = uri
    response: httpx.Response | None = None
    with httpx.Client(timeout=10, follow_redirects=False, headers={"User-Agent": "AI-HRMS-Agent/0.1"}, trust_env=False) as client:
        for _ in range(5):
            parsed = urlparse(url)
            _validate_public_http_url(parsed)
            response = client.get(url)
            if response.status_code not in {301, 302, 303, 307, 308}:
                break
            location = response.headers.get("location")
            if not location:
                break
            url = urljoin(url, location)
        if response is None:
            raise ValueError("url connector request was not created")
        response.raise_for_status()
    body = response.text[:512 * 1024]
    if "html" in response.headers.get("content-type", "") or "<html" in body.lower():
        body = strip_html(body)
    return ConnectorPreview("url", uri, body.strip(), [])


def _validate_public_http_url(parsed) -> None:
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("url connector requires http or https URI")
    if not parsed.hostname:
        raise ValueError("url connector requires a hostname")
    if parsed.username or parsed.password:
        raise ValueError("url connector does not allow embedded credentials")
    infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    for info in infos:
        candidate = ip_address(info[4][0])
        if (
            candidate.is_private
            or candidate.is_loopback
            or candidate.is_link_local
            or candidate.is_multicast
            or candidate.is_reserved
            or candidate.is_unspecified
        ):
            raise ValueError("url connector target is not a public address")


def _preview_local(uri: str) -> ConnectorPreview:
    root = os.environ.get("AI_HRMS_INGEST_ROOT")
    if not root:
        raise ValueError("directory connector requires AI_HRMS_INGEST_ROOT")
    root_path = Path(root).resolve()
    target = Path(uri).resolve()
    if root_path not in (target, *target.parents):
        raise ValueError("local connector path is outside AI_HRMS_INGEST_ROOT")
    if target.is_file():
        return ConnectorPreview("directory", target.name, _read_text_file(target), [])
    if not target.is_dir():
        raise ValueError("local connector path does not exist")
    chunks: list[str] = []
    for path in sorted(target.rglob("*")):
        if len(chunks) >= 20:
            break
        if path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS:
            chunks.append(f"# {path.name}\n{_read_text_file(path)}")
    if not chunks:
        raise ValueError("directory connector contained no readable text files")
    return ConnectorPreview("directory", target.name, "\n\n".join(chunks), [])


def _read_text_file(path: Path) -> str:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        raise ValueError("only txt, md, html, and htm files are supported")
    data = path.read_text(encoding="utf-8", errors="replace")[:256 * 1024]
    if path.suffix.lower() in {".html", ".htm"}:
        return strip_html(data)
    return data


def strip_html(value: str) -> str:
    value = re.sub(r"(?is)<(script|style)[^>]*>.*?</(script|style)>", " ", value)
    value = re.sub(r"(?s)<[^>]+>", " ", value)
    value = value.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", value).strip()
