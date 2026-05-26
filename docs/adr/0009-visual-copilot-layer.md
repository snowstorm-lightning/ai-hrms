# ADR 0009: Visual Copilot Layer

## Status

Accepted

## Decision

Visual Copilot is a global frontend layer mounted around authenticated pages and backed by Go APIs for validation, suggestions, previews, execution, and event history.

## Consequences

Frontend annotations use redacted snapshots and semantic business refs. Go validates refs and writes audit events for persisted actions.
