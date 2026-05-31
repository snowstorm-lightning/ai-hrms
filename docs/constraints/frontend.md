# Frontend Constraints

## Stack

- Use React, TypeScript, Ant Design, and a modern build setup.
- Do not carry over `react-scripts` from the source project.
- Do not add the source project's particle background dependency.

## Implementation Direction

- Build an AI-HRMS operating console first: command dashboard, governed knowledge, agent runs, growth evidence, and audit must be visible as system surfaces.
- Treat traditional HR pages as governed data-layer workbenches for scope, evidence, and permissions, not as the whole product.
- Use a centralized API client generated from OpenAPI when practical.
- Avoid scattering raw `axios` calls inside page components.

## Initial UI Scope

- Login.
- App shell with navigation.
- Current user profile.
- Legal entities.
- Organization units.
- Users.
- Employees with primary assignment as the organization data layer.

## AI-Native UI Scope

- AI Command Center.
- Page-level Visual Copilot overlay.
- Knowledge, learning, agent, and audit pages.
- Stable `data-vc-*` metadata on business rows, fields, actions, and objects.
