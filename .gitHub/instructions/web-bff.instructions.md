---
description: "Use when editing web-client BFF routes, Prisma-backed server logic, Next.js route handlers, auth-scoped data loaders, or server-side domain helpers for the budget app. Covers /api/bff patterns, auth, budget-plan scoping, Prisma, response-shape discipline, and pay-period-sensitive server behavior."
applyTo: "web-client/{app,lib,prisma,scripts}/**/*.{ts,tsx,js,mjs,prisma}"
---
# Web BFF Instructions

- Treat `web-client` as both the web product and the server/BFF layer for mobile.
- BFF routes under `app/api/bff/*` must preserve auth checks and budget-plan ownership boundaries.
- Keep Prisma schema as the authoritative model for structural data and enums.
- For schema changes, update Prisma schema, add/apply migrations, and keep API consumers aligned.
- Prefer server-side normalization and aggregation so clients receive UI-ready payloads.
- Keep server-only code in server-only modules.
- Preserve existing error shape conventions: structured JSON responses with status codes and stable error semantics.
- Prefer narrow refetches and targeted invalidation over expensive broad reload patterns.

## Server Architecture Details

- `web-client/app/api/bff/*` is the product API surface used by mobile.
- Shared route logic should prefer existing helpers in `web-client/lib/*` over route-local duplication.
- `web-client/lib/prisma.ts` is the canonical Prisma runtime entry and includes pooled connection configuration plus retry handling.
- Some routes already contain compatibility checks for transient schema/client mismatch windows. Preserve those defensive patterns when touching evolving schema fields.

## Pay Period And Summary Rules

- Use `web-client/lib/payPeriods.ts` as the canonical server-side pay-period helper.
- `payFrequency` supports `monthly`, `every_2_weeks`, and `weekly`.
- `billFrequency` is a separate concern and should not be collapsed into pay frequency.
- Monthly anchor behavior differs from weekly and biweekly anchor behavior; do not flatten these rules.
- Routes like `income-month`, `expenses/summary`, and `dashboard` are period-sensitive and should keep shared pay-period logic centralized.
- If a new period-sensitive feature is added, prefer using or extending shared pay-period helpers and period-context helpers rather than rebuilding date logic inside one route.

## Contract Discipline

- Mobile expects normalized, typed JSON payloads suitable for direct screen consumption.
- If you change a payload shape, update mobile consumer types and screen logic in the same task.
- Preserve route semantics that keep computed values canonical on the server, especially for dashboard, summaries, and income analysis.

## Server Architecture Notes

- `mobile-client` talks to these routes through `apiFetch`.
- Prisma uses pooled runtime connections and retry handling in `web-client/lib/prisma.ts`.
- Auth/session behavior must remain compatible with both web and mobile session flows.