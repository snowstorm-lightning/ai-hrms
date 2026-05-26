# Documentation Constraints

## Maintenance

Keep `AGENT.md`, constraint documents, ADRs, OpenAPI, README, and harness READMEs aligned with the current project direction.

Update documentation in the same change that alters architecture, workflows, harness behavior, or major implementation boundaries.

## Size

Keep `AGENT.md` under 80 lines.

If it grows beyond 80 lines, split details into constraint documents, ADRs, or harness READMEs and keep only indexes in `AGENT.md`.

## Style

- `AGENT.md` is an index, not a full specification.
- Constraint documents hold durable rules.
- ADRs hold accepted decisions.
- Harness READMEs explain executable verification.
- `packages/openapi/openapi.yaml` is the API contract index.
- Root `README.md` explains local startup and verification entry points.

## Review Checklist

- Check `AGENT.md` line count after every documentation edit.
- Keep indexed documents maintained when their index row changes.
- Prefer short documents with links over duplicating long rules in indexes.
