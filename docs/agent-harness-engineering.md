# AI-HRMS Agent Harness Engineering

AI-HRMS does not route every feature through an LLM. The product treats AI as one component inside a governed HR operating system.

## Core Rule

Program code owns deterministic work:

- RBAC, scope, identity, status machines, CRUD, SQL, pgvector retrieval, tool execution, audit writes.
- Risk pre-checks for high-impact HR decisions.
- Tool preview, schema validation, confirmation gates, rollback or compensation markers.

LLM calls are used only when language flexibility is valuable:

- Explain already-resolved HR context.
- Summarize cited knowledge or audit patterns.
- Draft onboarding, learning, mentor review, or workflow plans.
- Convert messy user intent into a structured preview.

Agent runs are reserved for bounded multi-step work:

- Cross-module analysis across RAG, learning, audit, and agent traces.
- Scoped aggregate analysis such as attendance real-time overview, where the
  agent may summarize signals and suggest review steps but cannot execute a
  people decision.
- Workflow drafting and evidence completeness checks.
- Independent risk review for high-complexity but non-executing HR analysis.

Multi-agent work is exceptional:

- Organization-level plans.
- Generator plus critic or verifier patterns.
- Long tasks that need separate traces and human handoff.

## Runtime Layers

1. Execution Router
   Classifies intent into `deterministic`, `retrieval_only`, `llm_explain`, `single_agent`, `multi_agent`, `action_preview`, or `human_review_required`.

2. Context Resolver
   Converts UI selection, route, prompt, object refs, RAG citations, audit records, and agent runs into a typed `ContextPacket`.

3. Tool Registry
   Defines tool purpose, required capability, risk level, write set, reversibility, and preview-only behavior.

4. Trust Packet
   Carries `riskLevel`, `confidence`, `humanReviewRequired`, `evidenceCount`, `citations`, `toolPreview`, `auditStatus`, and policy checks.

5. Audit Layer
   Records previews, blocked actions, context resolution, tool preview, human review, and final execution.

## Visual Copilot Boundary

DeepSeek currently provides text chat through an OpenAI-compatible API, not image understanding. Therefore Visual Copilot is not a screenshot interpreter.

It is a page-level context trigger:

```text
selection rect
→ DOM/business refs
→ Go context resolver
→ deterministic explanation or LLM summary
→ tool preview if action requested
→ human confirmation for high-risk work
→ audit
```

Screenshots, if present, are accepted only when redacted and are used for hashing or future audit evidence. They are not sent to DeepSeek for pixel-level analysis.

## Execution Policy

| Request type | Route |
| --- | --- |
| Count/list/status/open | Program or retrieval only |
| Attendance real-time overview | Program aggregate plus preview-only single agent |
| Knowledge question with citation | RAG retrieval, optional LLM explanation |
| Plan/explain/summarize | LLM explain with ContextPacket |
| Cross-module risk/workflow analysis | Bounded single agent |
| Independent generation plus review | Multi-agent, async run |
| Create/update/send/assign | Tool preview first |
| Hiring, firing, salary, promotion, performance verdicts | Blocked from automation; human review only |

## Implementation Map

- Go domain: `TrustPacket`, `ContextPacket`, `HarnessDecision`, `ToolPreview`.
- Go app: `harness.go` centralizes intent routing and tool registry.
- Go store: Visual resolver reads selected business refs from PostgreSQL;
  attendance overview builds scoped aggregates before any Agent analysis.
- Web: `AiTrust.tsx` renders trust packet, execution decision, and context packet.
- Agent service: remains a bounded language boundary; it does not own permissions or writes.
