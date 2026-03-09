# Budget App Workspace Instructions

This repository contains two product clients that share one backend system:

- `mobile-client` is an Expo / React Native app.
- `web-client` is a Next.js App Router app.
- `web-client/app/api/bff/*` is the backend-for-frontend layer consumed by mobile.
- Persistence is handled through Prisma against PostgreSQL.

## Architecture Priorities

- Treat `web-client` as the server architecture for product work unless a task is explicitly mobile-only.
- Preserve contract alignment between `mobile-client/lib/apiTypes.ts`, mobile consumers, and the BFF responses.
- Keep business logic close to the server/BFF when payloads are computed, aggregated, or reused across screens.
- Keep volatile presentation state local to small mobile child components instead of screen-level controllers when possible.

## How The App Works

- `mobile-client` does not talk directly to the database. It talks to `web-client/app/api/bff/*` through `mobile-client/lib/api.ts`.
- `mobile-client/lib/api.ts` is the canonical mobile HTTP layer. It handles session-token auth headers, request deduplication, short-lived GET caching, mutation cache invalidation, and unauthorized handling.
- `web-client` owns server-side computation for dashboard, expense summaries, income-month analysis, debt summaries, onboarding normalization, and other reusable budget logic.
- Prisma in `web-client/prisma/schema.prisma` is the source of truth for persisted structure, enums, and relation shape.
- `web-client/lib/prisma.ts` is the shared runtime Prisma entry and includes pooled connection settings plus retry behavior for retryable read operations.

## Pay Period And Cadence Rules

- Pay frequency is domain logic, not presentation. It changes how the app selects the active period, period anchors, labels, and month summaries.
- Supported pay frequencies are `monthly`, `every_2_weeks`, and `weekly`.
- `billFrequency` is separate from `payFrequency` and should not be collapsed into the same rule set.
- Monthly periods anchor differently from weekly and biweekly periods:
	- For monthly periods, the logical anchor month comes from the period end month.
	- For weekly and biweekly periods, the logical anchor month comes from the period start month.
- Mobile and web both implement pay-period helpers and should stay behaviorally aligned:
	- `mobile-client/lib/payPeriods.ts`
	- `web-client/lib/payPeriods.ts`
- New-plan handling matters. When a plan is created after the previous pay date but before the current pay date, the active monthly period should start at the current month's pay date instead of incorrectly anchoring to the prior cycle.
- Monthly income analysis should follow pay-period anchor logic rather than raw stored `month` and `year` alone.
- If a feature changes period labeling, month selection, pay-date math, income rollups, dashboard totals, or expense summary windows, verify both mobile and web logic.

## Server Architecture

- BFF routes live in `web-client/app/api/bff/*` and should return normalized, UI-ready JSON.
- Auth is required for BFF routes. They should resolve the session user and then resolve the owned budget plan before returning plan-scoped data.
- Reused domain logic should live in server helpers under `web-client/lib/*`, not duplicated across routes and clients.
- Keep server-only code server-only. Do not leak Prisma or server helpers into client bundles.
- When routes aggregate finance data, prefer server-side helpers that already encode period logic, ownership checks, and normalization.
- Preserve structured JSON error semantics for mobile consumers.

## Mobile Client Standards

- Keep hooks under `mobile-client/lib/hooks/<hook-name>/index.ts`.
- Import hooks through `@/hooks`, not direct `@/lib/hooks/...` paths.
- Keep component-local styles in co-located `style.ts` files.
- Do not define component-local types in component files; place them under `mobile-client/types/components/*` and import them from `@/types` where the repo already follows that pattern.
- Move reusable semantic constants into `mobile-client/lib/constants/*` and import them from `@/lib/constants`.
- Leave one-off layout numbers, geometry values, and animation tuning local unless reused across features.
- Prefer existing caches, RTK Query endpoints, and mutation invalidation patterns over ad hoc duplicate fetches.
- Respect pay-period logic. Income and expense flows are anchored to pay-period behavior, not naive calendar assumptions.
- Treat screen controllers/hooks as orchestration layers, not dumping grounds for duplicated server business logic.
- Prefer mutation results plus targeted refreshes over calling broad reload flows when updating settings, budget plans, income, or debts.
- Keep timers, local animation state, and transient presentation details in small child components when possible to avoid large rerenders.
- Reuse debt summary/detail caches and RTK Query invalidation patterns before adding new ad hoc fetches.
- Use `/api/bff/income-month` as the source of truth for detailed income month analysis rather than parallel custom reconstruction from `/api/bff/income`.

## Refactor And File-Splitting Standards

- Do not leave large component files in place when they are becoming hard to reason about. As a working rule, components should generally stay under 200 lines when practical.
- If a component grows beyond roughly 200 lines, first look for extraction opportunities before adding more logic:
	- child presentational components
	- controller hooks
	- local helper modules
	- co-located `style.ts`
- Keep screen files focused on composition and wiring. Move data orchestration into hooks and presentation fragments into child components.
- If styles live inline in a component and are more than a few one-off values, extract them into a co-located `style.ts`.
- If a constant is semantic, reusable, or domain-oriented, move it into `mobile-client/lib/constants/*` and re-export it from the constants barrel.
- If a value is one-off presentation tuning, keep it local instead of polluting shared constants.
- If a type is shared by multiple components or used as a component contract, move it into `mobile-client/types/components/*` or the existing type barrel instead of leaving it inside the component file.
- Prefer small focused files over mixed files that contain rendering, business rules, constants, styles, and types all at once.

## Hook Placement Rules

- Shared hooks belong in `mobile-client/lib/hooks/<hook-name>/index.ts`.
- Import shared hooks from `@/hooks`.
- Avoid creating new ad hoc hook locations under component folders unless the hook is truly private to that folder and intentionally local.
- If a hook starts being reused across features, promote it into `lib/hooks` and expose it through the hook barrel.
- Keep hooks focused on orchestration, state transitions, and side effects. Avoid turning them into large mixed-utility files.

## Web Client And BFF Standards

- Treat Prisma schema as the source of truth for server-side data shape.
- For schema or enum changes, update Prisma schema, generate/apply migrations, and keep API payload types aligned.
- BFF routes under `web-client/app/api/bff/*` should enforce auth and budget-plan ownership before returning data.
- Return normalized, UI-ready payloads from the BFF instead of pushing aggregation complexity into mobile.
- Keep server-only utilities in server-only modules and avoid leaking them into client bundles.
- Prefer targeted mutations and targeted refetches over broad reload patterns.
- Be careful with transient Prisma client/schema mismatch windows. Existing code already contains defensive capability checks and fallback behavior in some areas.
- Keep pay-period context, month-anchor derivation, and dashboard/income/expense summary calculations centralized in shared server helpers.

## Cross-Stack Change Rules

- When changing mobile data behavior, verify whether the source of truth belongs in a BFF route instead of a screen controller.
- When changing a BFF response, update dependent mobile types and consumers in the same task.
- When changing onboarding goals, debt structures, income timing, or notification behavior, verify Prisma schema, migrations, and any normalization logic.
- Reuse existing repo patterns before introducing new state management or transport abstractions.
- For period-sensitive work, check whether both mobile and web helper implementations need to move together.
- For auth-sensitive work, preserve compatibility with both the web session flow and the mobile stored-session flow.
- For dashboard and summary work, check whether the same derived value already exists server-side before adding new client computation.

## Budget Domain Expectations

- `Expense.isExtraLoggedExpense` is persisted state, not a value to re-derive from other fields.
- Monthly income analysis should follow pay-period anchor logic.
- Debt detail flows should reuse summary/cache data where practical rather than refetching everything eagerly.
- Settings flows should prefer mutation results plus narrow refreshes instead of full reloads.
- Dashboard AI tips are server-generated; mobile should display them rather than regenerate them.
- Logged expenses funded by income can still participate in the main expense summary; non-income logged payments belong in a separate logged-payments bucket.
- Onboarding goal changes are schema-sensitive. New goal values often require Prisma enum updates plus migrations, not just TypeScript edits.
- Legacy onboarding goal values may need normalization so reopened onboarding and downstream goal UIs stay aligned.
- Debt-tab visibility is influenced by onboarding debt preference and real debt data, not only by current screen state.
- Navigation and period sync behavior should avoid noisy server writes and avoid resetting nested flows unnecessarily.
- Notification behavior should keep scheduled reminders and immediate paid/unpaid UI state transitions in sync.

## High-Risk Areas

- `dashboard`
- `expenses/summary`
- `income-month`
- onboarding/profile normalization
- debt summary/detail/payment flows
- settings and budget-plan mutations
- receipt scan and confirmation flows
- notifications and push token delivery

## Validation

- Run focused validation for the area changed.
- For mobile changes, prefer `cd mobile-client && npm run typecheck` and lint where relevant.
- For web changes, prefer `cd web-client && npm run lint` or other targeted validation for the touched area.
- For cross-stack work, validate both sides that changed.
- Call out uncertainty explicitly when server behavior is inferred rather than visible in code.