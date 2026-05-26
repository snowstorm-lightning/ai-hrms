# ADR 0002: Start As Modular Go Monolith

## Status

Accepted

## Context

The source project splits backend responsibilities across Java modules and service ports. The new project needs faster reproduction and simpler consistency.

## Decision

Start with one Go API service organized by internal modules.

## Consequences

- Cross-module writes can use local transactions.
- Deployment is simpler during MVP.
- Modules can be extracted later if operational pressure justifies it.
