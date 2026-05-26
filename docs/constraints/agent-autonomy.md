# Agent Autonomy Constraints

## Autonomy Levels

Agents may execute low-risk work automatically when capability, scope, and audit checks pass.

Medium-risk work must create an action plan and rollback or compensation path.

High-risk work requires explicit confirmation before execution.

## Execution Boundary

All HRMS reads, writes, tool calls, and audit events go through Go.

Python agents must not accept a naked `user_id` as trusted identity.

## People Decisions

Agents provide evidence, suggestions, and alternatives for people-related decisions.

They do not make final decisions for promotion, performance, pay, or termination.
