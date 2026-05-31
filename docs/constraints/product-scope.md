# Product Scope Constraints

## Scope

AI-HRMS is a Human-Agent Symbiotic HR Operating System. It connects governed organization data, knowledge, learning growth, agent collaboration, human review, and audit evidence so HR work can be performed inside traceable boundaries.

The current demo uses one fictional sample company group with subsidiaries and organization units. That company data is a demo dataset and scope model, not the product positioning.

## Initial Reproduction Target

- Authentication, current user profile, and role/scope bindings.
- Legal entities, organization units, employees, assignments, attendance, and messages as the Organization Data Layer.
- Governed Knowledge Hub, RAG search, citations, sensitivity, trust level, and scope controls.
- AI Command Center, Agent Run Center, Visual Copilot, and tool preview surfaces.
- Learning Layer and Co-Growth OS as the Human-AI Co-evolution/Growth Engine.
- Trust, Audit & Evidence Layer for AI suggestions, tool previews, human review, and high-risk blocked events.

## Deferred Scope

- Full multi-assignment UI beyond primary assignment.
- Production-grade workflow queueing, retry orchestration, and long-running agent scheduling.
- Redis-backed cache, queue, or rate limiting.
- Vision-model screenshot understanding for Visual Copilot; current DeepSeek setup is text/context only.

## Source Project Interpretation

- `../saas_hrms` is a historical implementation reference, not the product narrative.
- `co_company` becomes legal entity data, not SaaS tenant data.
- `co_department` becomes organization unit data.
- `bs_user.company_id` and `bs_user.department_id` become source hints for primary assignment.
- The SaaS tenant model is not reproduced.
