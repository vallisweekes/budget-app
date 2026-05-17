# BFF Patterns

- BFF routes live in `web-client/app/api/bff/*`.
- Prisma schema in `web-client/prisma/schema.prisma` is the structural source of truth.
- Runtime Prisma access uses `web-client/lib/prisma.ts`, which applies pooled connection settings and retry behavior.
- Mobile depends on these endpoints through `mobile-client/lib/api.ts` and expects stable, typed JSON responses.
- Schema and enum changes require Prisma updates plus migrations, and often require mobile payload/type updates in the same task.
- Prefer normalized, UI-ready responses rather than making clients reconstruct dashboards, summaries, or pay-period analysis.

## Server And Domain Rules

- Reuse shared pay-period helpers in `web-client/lib/payPeriods.ts` rather than rebuilding date logic in routes.
- Preserve auth plus owned-budget-plan resolution in BFF route handlers.
- Period-sensitive routes include `dashboard`, `income-month`, and `expenses/summary`.
- `billFrequency` and `payFrequency` are separate concepts.
- Compatibility guards around evolving schema fields and snapshots are deliberate and should not be stripped casually.
- Keep error payloads structured and stable for mobile callers.