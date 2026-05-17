# Mobile Patterns

- Hooks live in `mobile-client/lib/hooks/<hook-name>/index.ts` and are imported from `@/hooks`.
- Screen and feature folders typically keep `index.tsx`, `style.ts`, local helpers, and smaller child components together.
- Shared semantic constants belong in `mobile-client/lib/constants/*`.
- Shared component types belong under `mobile-client/types/components/*` and should be imported through existing type barrels where available.
- Mobile API calls should prefer existing RTK Query endpoints or the shared `apiFetch` wrapper rather than bespoke fetch utilities.
- Keep expensive derived logic or multi-consumer data shaping on the BFF when possible.
- Respect repo-specific domain rules around pay periods, onboarding normalization, debt caching, and persisted logged-expense flags.

## Refactor Thresholds

- As a default threshold, do not keep components over roughly 200 lines when they can be split cleanly.
- Split large files by responsibility:
	- rendering sections into child components
	- orchestration into hooks
	- reusable values into constants modules
	- styles into `style.ts`
	- contracts into shared types
- Keep screen files compositional. Avoid mixing large style blocks, helper functions, types, constants, and orchestration into the same file.

## Placement Rules

- Shared hooks go in `mobile-client/lib/hooks/<hook-name>/index.ts`.
- Shared semantic constants go in `mobile-client/lib/constants/*`.
- Shared component types go in `mobile-client/types/components/*`.
- Co-located feature styles go in `style.ts` next to the component.
- One-off geometry and animation tuning can stay local if it is not reused.

## Pay Period Rules

- Use `mobile-client/lib/payPeriods.ts` for pay-period resolution.
- Supported pay frequencies: `monthly`, `every_2_weeks`, `weekly`.
- `monthly` period anchors follow the period end month.
- `weekly` and `every_2_weeks` anchors follow the period start month.
- `planCreatedAt` matters for correct first-period behavior for newly created plans.
- If a mobile screen depends on month labels, period labels, income summaries, expense windows, or dashboard totals, treat cadence math as domain logic, not display logic.

## Data And Mutation Patterns

- `mobile-client/lib/api.ts` already handles auth headers, deduplication, short cache TTLs, and mutation invalidation.
- Prefer targeted refreshes over broad reloads after mutations.
- Use `/api/bff/income-month` as the canonical detailed income month source.
- Reuse debt summary/detail cache data where possible.
- Keep server-generated dashboard recap/AI tips as display data on mobile.