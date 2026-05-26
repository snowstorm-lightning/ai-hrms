# Frontend Constraints

## Stack

- Use React, TypeScript, Ant Design, and a modern build setup.
- Do not carry over `react-scripts` from the source project.
- Do not add the source project's particle background dependency.

## Implementation Direction

- Reuse page workflow ideas from `../saas_hrms`.
- Redesign layout and page composition for a cleaner enterprise HRMS experience.
- Use a centralized API client generated from OpenAPI when practical.
- Avoid scattering raw `axios` calls inside page components.

## Initial UI Scope

- Login.
- App shell with navigation.
- Current user profile.
- Legal entities.
- Organization units.
- Users.
- Employees with primary assignment.

## AI-Native UI Scope

- AI Command Center.
- Page-level Visual Copilot overlay.
- Knowledge, learning, agent, and audit pages.
- Stable `data-vc-*` metadata on business rows, fields, actions, and objects.
