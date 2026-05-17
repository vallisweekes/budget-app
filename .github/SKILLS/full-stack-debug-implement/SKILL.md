---
name: full-stack-debug-implement
description: "Inspect, debug, fix, or implement work anywhere in the budget-app repository. Use when the task may start in mobile-client, web-client, Prisma, auth, onboarding, dashboard, expenses, income, debts, settings, notifications, or shared contracts and you need the agent to find the real controlling implementation before changing code."
argument-hint: "Describe the failing behavior, feature, route, screen, error, or file area to inspect"
user-invocable: true
---

# Full Stack Debug And Implement

Use this skill when the task is not obviously isolated to mobile-only or BFF-only code and the agent needs to inspect the real implementation path before making changes.

## What This Skill Covers

- `mobile-client` feature bugs and UI flows
- `web-client` pages, server helpers, and `/api/bff/*` route handlers
- Prisma schema-sensitive behavior and server data shaping
- Cross-stack contract mismatches between mobile types and BFF responses
- Debugging tasks where the visible symptom and root cause may live in different folders

## Procedure

1. Start from the most concrete anchor available: a failing route, screen, component, hook, error, payload, stack trace, or nearby implementation file.
2. Find the controlling layer before editing. Do not stop at wiring if the real behavior is computed deeper in the stack.
3. Keep server-side computation in `web-client` when the same result is reused across clients.
4. If payload shape or domain behavior changes, update the dependent mobile types and consumers in the same task.
5. Keep auth, owned budget-plan resolution, pay-period logic, and normalized response semantics intact.
6. Validate the touched slice first, then run the narrowest broader check that matches the changed area.

## Validation Expectations

- For `mobile-client`, prefer targeted typecheck or lint for the touched surface.
- For `web-client`, prefer targeted lint or route-adjacent validation for the changed server path.
- For Prisma or contract changes, validate both the server side and the consuming client side.

## Guardrails

- Do not duplicate shared business rules across mobile and web when a shared or server helper already owns them.
- Do not weaken auth or budget-plan ownership checks while debugging.
- Do not treat pay-period, onboarding-goal, debt, or summary logic as presentation-only behavior.
- Do not make schema-sensitive changes without updating Prisma definitions and dependent contracts when required.

## When Not To Use

- Use `mobile-feature-delivery` when the task is clearly mobile-only.
- Use `web-bff-delivery` when the task is clearly scoped to `web-client` server behavior.
- Use `cross-stack-contract-changes` when the change is explicitly about moving a request/response contract together.