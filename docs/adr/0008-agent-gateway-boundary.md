# ADR 0008: Agent Gateway Boundary

## Status

Accepted

## Decision

Go is the Agent Gateway. Python agents receive delegated run context and call Go-owned tools for HRMS data and actions.

## Consequences

Python does not query HRMS business tables and does not trust naked user identifiers.
