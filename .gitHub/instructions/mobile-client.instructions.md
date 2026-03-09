---
description: "Use when editing mobile-client screens, hooks, components, navigation, state, or Expo React Native code in this budget app. Covers hook layout, component architecture, styles, types, constants, caching, pay-period behavior, and mobile-to-BFF integration patterns."
applyTo: "mobile-client/**/*.{ts,tsx,js}"
---
# Mobile Client Instructions

- Treat `mobile-client` as a typed Expo app that consumes `web-client/app/api/bff/*` as its backend.
- Keep hooks in `lib/hooks/<hook-name>/index.ts` and import them from `@/hooks`.
- Keep reusable semantic constants in `lib/constants/*` and import them from `@/lib/constants`.
- Keep component-local styles in co-located `style.ts` files.
- Keep component-local types out of component files; use `types/components/*` and shared `@/types` imports where the project already exposes them.
- Reuse existing screen controllers, caches, and RTK Query endpoints before adding new fetch layers.
- Prefer server-computed payloads over duplicating business logic in screen components.
- Respect pay-period logic, onboarding normalization rules, debt cache reuse, and targeted refresh patterns already established in the app.
- Avoid broad full-screen rerender triggers for volatile UI timers or transient animations.

## File Size And Splitting

- Components should generally stay under 200 lines when practical.
- If a component grows beyond roughly 200 lines, prefer splitting before adding more code.
- Extract child components for repeated or visually distinct sections.
- Extract controller logic into hooks when a screen is mixing rendering with data orchestration or side effects.
- Extract styles into co-located `style.ts` files instead of leaving large style objects in component files.
- Extract semantic constants into `lib/constants/*` and keep one-off layout values local.
- Extract shared component types into `types/components/*` or an existing type barrel instead of leaving `type Props` or similar definitions in the component file.

## Hook And Module Placement

- Shared hooks belong in `mobile-client/lib/hooks/<hook-name>/index.ts`.
- Import shared hooks from `@/hooks`.
- Do not introduce new direct `@/lib/hooks/...` imports.
- If logic is reused across screens or feature folders, it should probably not stay inside a component file.
- Prefer small helper modules over letting one component own unrelated formatting, mapping, constants, and orchestration logic.

## Pay Period Behavior

- Use `mobile-client/lib/payPeriods.ts` as the mobile reference for active period resolution, month anchors, and pay-period labels.
- `payFrequency` supports `monthly`, `every_2_weeks`, and `weekly`.
- For `monthly`, the anchor month follows the period end month.
- For `weekly` and `every_2_weeks`, the anchor month follows the period start month.
- New-plan creation timing affects monthly anchor behavior. Do not simplify away the `planCreatedAt` checks when period selection or dashboard/income screens are involved.
- If you change mobile pay-period behavior, verify whether the equivalent server behavior in `web-client/lib/payPeriods.ts` must also change.

## Mobile Data Expectations

- `apiFetch` already handles auth headers, cache TTLs, inflight deduplication, mutation invalidation, and unauthorized callbacks.
- Prefer `/api/bff/income-month` for income month screens and derived month analysis.
- Prefer existing expense/debt caches and RTK Query invalidation patterns before adding new reload chains.
- Reuse summary-side debt data where practical instead of refetching full debt detail immediately.
- When mutating settings, income, debts, or budget-plan fields, prefer narrow refreshes and mutation returns over full app reloads.

## Domain Rules

- `Expense.isExtraLoggedExpense` is persisted and should not be re-derived in UI code.
- Monthly income behavior is pay-period driven, not plain calendar-month driven.
- Dashboard AI tips are already server-generated.
- Notification-related paid/unpaid flows should keep reminder scheduling and clearing behavior aligned with visible state.

## Validation

- Run `cd mobile-client && npm run typecheck` after meaningful TypeScript changes.
- Run lint when touching shared patterns, imports, or wider refactors.