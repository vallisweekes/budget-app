---
name: refactor
description: "Run a safe modular refactor workflow. Use when the user asks 'refactor' or wants business logic moved out of components into hooks/helpers, types moved into the types folders, file-size cleanup toward <=200 lines, and zero-error validation."
argument-hint: "Optional scope (file, folder, or feature) and constraints"
user-invocable: true
---

# Refactor

Use this skill for safe, non-breaking refactors that improve modularity and maintainability.

## Goals

- Move business logic out of UI-heavy components into hooks or helpers.
- Keep shared/static types in the types layer and import through existing barrels.
- Keep behavior unchanged.
- Move toward component file size under 200 lines when practical.
- Finish with no new lint/type errors in touched files.

## Rules

1. Preserve behavior and API contracts.
2. Do not mix large refactors with unrelated changes.
3. Extract in this order when possible:
   - `hooks` for state/effects/orchestration
   - `helpers` for pure transforms/calculations
   - `types` for component contracts and shared shapes
4. For mobile-client, prefer type imports from `@/types` where the repo already exposes them.
5. For web-client, prefer imports from `@/types` and existing barrels in `web-client/types`.
6. Keep edits incremental and validated after each significant extraction.

## Suggested Command Sequence

1. Scan for refactor candidates and guardrails:
   - `node scripts/refactor-scan.mjs`
2. Check line-limit pressure:
   - `node scripts/check-max-lines.mjs mobile-client/components 200`
   - `node scripts/check-max-lines.mjs web-client/components 200`
3. Apply focused refactor for selected scope.
4. Validate:
   - `cd mobile-client && npm run typecheck` (for mobile edits)
   - `cd web-client && npm run lint -- <paths>` (for web edits)
5. Re-run scan to confirm no new violations in touched files.

## Refactor Pattern

1. Identify stateful/business blocks inside component files.
2. Extract pure business logic to helper modules first.
3. Extract orchestration and side effects to hooks.
4. Move local reusable types into the proper `types` directory.
5. Keep component files focused on composition and rendering.
6. Update imports to use barrels/path aliases already used in the repository.

## Output Expectations

- A concise change summary.
- Explicit list of extracted hooks/helpers/types.
- Validation commands run and outcomes.
- Any residual risks or intentionally deferred extractions.
