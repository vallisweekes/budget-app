---
description: Use when a task needs an end-to-end understanding of how the full budget app works across mobile-client, web-client, the BFF, Prisma, onboarding, dashboard, income, expenses, debts, settings, notifications, receipts, or pay-period behavior.
applyTo: "{mobile-client,web-client}/**/*.{ts,tsx,js,mjs,prisma}"
---
# Full App Architecture

This repository is one product with two clients and one active server layer.

- `mobile-client` is the Expo / React Native mobile app.
- `web-client` is the Next.js App Router web app.
- `web-client/app/api/bff/*` is the backend-for-frontend consumed by mobile.
- Prisma plus PostgreSQL are the system of record for persisted budget data.

## Runtime Boundaries

- Mobile does not talk directly to the database.
- Mobile uses `mobile-client/lib/api.ts` as the canonical HTTP layer.
- The BFF owns auth checks, budget-plan ownership checks, aggregation, normalization, and most reusable finance computation.
- Prisma schema in `web-client/prisma/schema.prisma` is the authoritative structural model.
- Shared server logic belongs in `web-client/lib/*`, not inside screen controllers or ad hoc route-local duplication.

## Full Request Flow

1. A mobile screen, hook, or web route needs data.
2. Mobile requests a BFF route through `mobile-client/lib/api.ts`.
3. The BFF authenticates the user and resolves the owned `budgetPlanId`.
4. The BFF queries Prisma and server helpers, then computes a normalized payload.
5. Mobile consumes that payload through typed API contracts and local caches.

For most product changes, the controlling source of truth should stay on the server.

## Auth Model

- Browser sessions use the web auth flow.
- Mobile uses stored session-token auth that is still validated by the BFF auth layer.
- BFF routes should preserve the behavior implemented around `getSessionUserId`, `getSessionIdentity`, and `resolveOwnedBudgetPlanId`.
- Never bypass ownership checks for `budgetPlanId`-scoped reads or mutations.

## Product Areas

### Onboarding

- Onboarding affects user setup, default plan generation, downstream settings, goals, debt visibility, and pay-period cadence.
- Legacy onboarding values may require normalization when editing downstream flows.
- New onboarding goal values are often schema changes, not just UI changes.

### Dashboard

- Dashboard is a server-computed summary surface.
- It depends on pay-period logic, expense summaries, debt summaries, goal selections, AI tips, and plan metadata.
- Prefer changing shared helpers over adding client-side reconstruction.

### Expenses

- Expenses include recurring bills, allocation rows, logged extras, payment sources, debt conversion, and pay-period grouping.
- `Expense.isExtraLoggedExpense` is persisted state and should not be re-derived.
- Expense summaries and month groupings are period-sensitive and server-owned.

### Income

- Income is anchored to pay-period rules, not only raw month and year fields.
- `income-month` is the canonical detailed month analysis endpoint.
- If a change affects income anchoring or period selection, verify both mobile and web pay-period helpers.

### Debts

- Debt flows include summaries, details, payment history, payoff projections, card-backed funding, and cache reuse.
- Debt tab visibility depends on onboarding debt preference and actual debt data.
- Detail flows should reuse summary-derived data and caches where practical.

### Settings And Budget Plans

- Settings and budget-plan mutations often affect dashboard data, pay-period behavior, onboarding assumptions, and profile payloads.
- Prefer mutation results plus narrow refreshes over broad reload flows.

### Notifications And Receipts

- Notifications should keep scheduled reminder behavior and immediate UI state transitions aligned.
- Receipt scan and confirmation flows are server-sensitive and should preserve structured JSON error behavior.

## Pay Period Model

- Pay frequency is domain logic, not presentation-only state.
- Supported pay frequencies are `monthly`, `every_2_weeks`, and `weekly`.
- `billFrequency` is separate from `payFrequency`.
- Monthly periods anchor by the period end month.
- Weekly and biweekly periods anchor by the period start month.
- Mobile and web pay-period helpers must remain behaviorally aligned:
  - `mobile-client/lib/payPeriods.ts`
  - `web-client/lib/payPeriods.ts`
- If a task changes period labels, anchor math, expense windows, dashboard totals, or income month analysis, validate both sides.

## Data And Contract Rules

- Treat BFF responses as canonical UI-ready contracts.
- When a BFF payload changes, update the dependent mobile types and consumers in the same task.
- Keep shared business rules on the server when more than one screen or client depends on them.
- Keep Prisma schema, migrations, and API payloads aligned for structural changes.

## Caching And Invalidation

- Mobile request caching and invalidation live in `mobile-client/lib/api.ts`.
- Server-side derived caches are commonly scoped by `budgetPlanId` plus period context.
- Mutations affecting expenses, income, debts, allocations, onboarding, dashboard, or settings should invalidate affected derived summaries.
- Avoid adding duplicate ad hoc caches when a repo pattern already exists.

## Where To Put Logic

- Put reusable domain computation in `web-client/lib/*`.
- Put BFF orchestration in `web-client/app/api/bff/*`.
- Put mobile orchestration in hooks and screen controllers.
- Keep volatile presentation state in small mobile child components where possible.
- Do not push Prisma or server-only helpers into client bundles.

## Change Routing Guidance

- If the same derived value is useful to both web and mobile, compute it server-side.
- If the task is visual-only and does not alter shared business rules, keep it local to the client.
- If the task changes onboarding, pay cadence, dashboard summaries, income analysis, debt behavior, settings, or notifications, assume cross-stack impact until proven otherwise.
- If the task changes persisted structure or enums, update Prisma schema and migrations first.

## High-Risk Surfaces

- `dashboard`
- `expenses/summary`
- `income-month`
- onboarding normalization and profile repair behavior
- debt summary, detail, and payment flows
- budget-plan and settings mutations
- receipts
- notifications and push token handling

## Validation Expectations

- Run focused validation for the area changed.
- For mobile changes, prefer `cd mobile-client && npm run typecheck`.
- For web and BFF changes, prefer `cd web-client && npm run lint` or another narrow validation command.
- For cross-stack changes, validate both sides that changed.
- If no executable validation exists for instruction-only edits, inspect the diff for correctness and consistency.