# ADR 0005: Use OpenAPI As API Contract

## Status

Accepted

## Context

The new frontend and backend should not rely on hand-synchronized endpoint strings.

## Decision

Use OpenAPI as the integration contract between Go API and React frontend.

## Consequences

- Contract changes become explicit.
- Frontend API clients can be generated.
- API harness tests can validate examples and response shapes.
