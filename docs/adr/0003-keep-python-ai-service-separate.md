# ADR 0003: Keep Python AI Service Separate

## Status

Accepted

## Context

AI and RAG code benefits from Python ecosystem support and `uv` dependency management.

## Decision

Keep AI agent and RAG-specific code in `apps/agent`.

## Consequences

- Go remains the business API and authorization boundary.
- Python calls controlled Go APIs or tools for HRMS data.
- AI work can evolve without coupling the Go service to Python dependencies.
