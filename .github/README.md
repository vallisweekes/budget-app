# Budget App AI Guidance

This `.github` folder contains the repository-specific guidance that helps coding agents understand how the full budget app works.

## Layout

- `copilot-instructions.md`: workspace-wide guidance that applies to the whole repository.
- `instructions/full-app-architecture.instructions.md`: canonical end-to-end architecture map for the full app.
- `instructions/mobile-client.instructions.md`: mobile-specific implementation conventions.
- `instructions/web-bff.instructions.md`: Next.js BFF and Prisma server conventions.
- `instructions/cross-stack-contracts.instructions.md`: rules for changes that affect both mobile and server behavior.
- `agents/develop.agent.md`: the default development agent profile for this repo.
- `SKILLS/*`: deeper implementation workflows and checklists for specific delivery types.

## How To Use It

- Use the full-app architecture instruction when the task spans mobile, web, BFF, onboarding, dashboard, settings, debts, income, expenses, notifications, or pay-period behavior.
- Use the mobile or web instruction files for changes that stay inside one side of the product.
- Use the cross-stack instruction whenever the API contract, pay-period logic, onboarding normalization, or shared business rules move together.

## Canonical Product Shape

- `mobile-client` is the Expo React Native client.
- `web-client` is the Next.js web app and the current backend-for-frontend for mobile.
- `web-client/app/api/bff/*` is the server API surface consumed by mobile.
- Prisma and PostgreSQL are the source of truth for persisted finance data.