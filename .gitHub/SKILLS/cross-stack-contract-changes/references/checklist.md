# Cross-Stack Checklist

1. Confirm which BFF route or server helper is the source of truth.
2. Check whether `mobile-client/lib/apiTypes.ts` or related mobile type surfaces need updates.
3. Check whether mobile caches, RTK Query tags, or controller hooks need invalidation changes.
4. Check whether Prisma schema or enums need migration work.
5. Check whether auth and budget-plan ownership boundaries still hold.
6. Run the narrowest meaningful validation on both sides touched by the change.
7. Check whether pay-period helper behavior must stay aligned across `mobile-client/lib/payPeriods.ts` and `web-client/lib/payPeriods.ts`.
8. Check whether monthly vs weekly/biweekly anchor behavior changes downstream summaries, labels, or navigation state.
9. Check whether onboarding normalization, debt cache reuse, logged-expense rules, or notification lifecycle rules are affected.