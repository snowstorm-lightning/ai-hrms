# Testing Harness Constraints

## Purpose

Harnesses make agent-driven work repeatable and verifiable.

## Harnesses

- `harness/bootstrap`: local tool availability.
- `harness/database`: PostgreSQL migrations and seed data.
- `harness/api`: OpenAPI-facing API smoke tests.
- `harness/frontend`: type checks, build, and future browser smoke checks.
- `harness/agent`: Python agent boundary and future AI evaluations.
- `harness/e2e`: cross-service HRMS workflow checks.

## Rule

Every major workflow should eventually have a command that verifies it without manual inspection.

## Documentation

Each harness directory should include a `README.md` with prerequisites, command,
current checks, and planned coverage. Update the README when a harness script
changes behavior.
