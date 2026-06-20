---
name: refactor
description: "Run a safe modular refactor on the requested scope: extract business logic to hooks/helpers, move shared types to types folders, and validate no new errors."
argument-hint: "Scope (file/folder/feature) plus constraints"
agent: "agent"
---
Run the `refactor` workflow on the user-provided scope (file, folder, or feature).

Requirements:
- Preserve behavior and public contracts.
- Extract business logic from large components into hooks/helpers.
- Move reusable type declarations into the proper `types` folders and import using existing aliases/barrels.
- Keep component files <= 200 lines when practical.
- Validate before finishing and report any residual risks.

Validation checklist:
- `node scripts/refactor-scan.mjs`
- `node scripts/check-max-lines.mjs mobile-client/components 200`
- `node scripts/check-max-lines.mjs web-client/components 200`
- `cd mobile-client && npm run typecheck` (if mobile touched)
- `cd web-client && npm run lint -- <paths>` (if web touched)
