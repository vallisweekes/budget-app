---
name: mobile-feature-delivery
description: "Implement or refactor mobile-client features in the budget app. Use for Expo React Native screens, hooks, navigation, typed screen controllers, constants, styles, component decomposition, and mobile integration with the BFF API."
argument-hint: "Describe the mobile feature, screen, flow, or refactor to implement"
user-invocable: true
---

# Mobile Feature Delivery

Use this skill when the task is primarily inside `mobile-client`.

## What This Skill Assumes

- The app is Expo + React Native.
- The mobile app consumes `web-client/app/api/bff/*` through `apiFetch` and RTK Query.
- The repo prefers controller-style hooks, extracted styles, shared constants, and centralized types.

## Procedure

1. Identify the source of truth for the screen or feature.
2. Reuse existing hooks from `@/hooks`, constants from `@/lib/constants`, and shared types from `@/types` where available.
3. Keep feature code split cleanly between controller logic, presentational components, and style files.
4. Preserve pay-period, onboarding, debt, and settings patterns already used in the app.
5. Validate with `cd mobile-client && npm run typecheck`.

## Guardrails

- Do not reintroduce direct `@/lib/hooks/...` imports.
- Do not move reusable business logic into large screen components if it belongs in hooks or the BFF.
- Do not leave reusable semantic constants inside components.

## References

- [Mobile Patterns](./references/patterns.md)