---
name: web-bff-delivery
description: "Implement or refactor web-client backend-for-frontend logic in the budget app. Use for Next.js App Router route handlers, Prisma-backed business logic, auth-scoped endpoints, server-only helpers, analytics payloads, and API response shaping for mobile and web."
argument-hint: "Describe the BFF route, server helper, or Prisma-backed change to implement"
user-invocable: true
---

# Web BFF Delivery

Use this skill when the task primarily changes `web-client` server behavior.

## What This Skill Assumes

- `web-client` is both the web app and the backend-for-frontend for mobile.
- Data is persisted with Prisma and PostgreSQL.
- Many mobile screens depend on pre-computed BFF payloads instead of raw records.

## Procedure

1. Locate the authoritative route or server helper under `web-client/app/api/bff` or `web-client/lib`.
2. Preserve auth and ownership checks for the active user and budget plan.
3. Keep computation, normalization, and aggregation on the server when it benefits multiple clients.
4. If the shape changes, identify downstream mobile consumers and update them.
5. Validate with the narrowest relevant command, then run broader web validation if the change is structural.

## Guardrails

- Do not bypass Prisma schema when introducing structural data changes.
- Do not weaken auth checks for convenience.
- Do not push shared server logic into client-side duplication.

## References

- [BFF Patterns](./references/patterns.md)