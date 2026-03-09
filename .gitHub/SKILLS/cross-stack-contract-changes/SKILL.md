---
name: cross-stack-contract-changes
description: "Coordinate mobile-client and web-client changes for shared business rules and API contracts in the budget app. Use for onboarding, expenses, income, debts, settings, notifications, receipts, pay-period logic, and any change where the BFF response and mobile consumer must evolve together."
argument-hint: "Describe the cross-stack behavior or contract that needs to change"
user-invocable: true
---

# Cross-Stack Contract Changes

Use this skill when work must stay aligned across mobile, web, and server-side data rules.

## Procedure

1. Identify the authoritative server/BFF contract.
2. Identify the mobile screens, hooks, caches, or types that consume it.
3. Make the server and mobile changes in the same task so the contract never drifts.
4. Check for Prisma schema, enum, migration, and normalization implications.
5. Validate both sides that changed.

## High-Risk Areas

- Onboarding goals and onboarding completion state
- Pay-period anchored income and expense logic
- Debt summaries, debt payments, and cache reuse
- Settings and budget-plan scoped data
- Notification delivery and push token flows
- Receipt scan payloads and follow-up confirmation flows

## References

- [Cross-Stack Checklist](./references/checklist.md)