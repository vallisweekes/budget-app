---
description: "Use when a task spans mobile-client and web-client, especially API contract changes, onboarding, pay-period logic, notifications, debts, income, settings, or any shared business rule between the mobile app and the BFF/server layer."
---
# Cross-Stack Contract Instructions

- Verify where the source of truth should live before implementing the change.
- If a response shape changes in the BFF, update mobile types and consumers in the same task.
- If a mobile screen computes data that is also needed elsewhere, consider moving that computation into the BFF.
- Be explicit about whether behavior is verified in code or inferred from surrounding architecture.
- For onboarding goals, pay-period logic, debt/payment rules, notifications, and receipt flows, check for schema, enum, cache, and normalization impacts before finishing.

## Period And Cadence Checks

- Check both `mobile-client/lib/payPeriods.ts` and `web-client/lib/payPeriods.ts` when changing active-period behavior.
- Monthly anchors are based on period end month; weekly and biweekly anchors are based on period start month.
- New-plan creation timing can affect the current monthly period and should not be ignored.
- `income-month`, `dashboard`, and `expenses/summary` are especially sensitive to anchor and cadence drift.

## Contract Hotspots

- `mobile-client/lib/apiTypes.ts`
- `web-client/app/api/bff/income-month/*`
- `web-client/app/api/bff/dashboard/*`
- `web-client/app/api/bff/expenses/summary/*`
- onboarding goal/profile data
- debt summary/detail/payment payloads
- settings and budget-plan scoped payloads

## Checklist

1. Confirm server source of truth.
2. Update shared payload types and consumers.
3. Validate ownership/auth scope remains intact.
4. Run focused validation in both clients when the contract changed.
5. Check pay-period, cadence, and plan-created-at effects where relevant.
6. Check Prisma schema or enum migration impact where relevant.