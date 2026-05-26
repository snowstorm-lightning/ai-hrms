# Product Scope Constraints

## Scope

AI-HRMS is a single-company HRMS for one corporate group. The group can contain multiple subsidiaries with independent legal entity attributes.

The project starts by reproducing useful flows from `../saas_hrms`, then improves data modeling, security, API contracts, and UI.

## Initial Reproduction Target

- Authentication and current user profile.
- Legal entity and organization unit browsing.
- User and employee management.
- Role binding management.
- Primary employee assignment.
- Attendance records.
- Employee and attendance CSV export.
- Messages and comments.
- Employee profile fields from the source project, retained where useful and pruned only with an explicit decision.

## Deferred Scope

- Full multi-assignment UI beyond primary assignment.
- AI agent features and RAG.
- Redis-backed cache, queue, or rate limiting.

## Source Project Interpretation

- `co_company` becomes legal entity data, not SaaS tenant data.
- `co_department` becomes organization unit data.
- `bs_user.company_id` and `bs_user.department_id` become source hints for primary assignment.
- The SaaS tenant model is not reproduced.
