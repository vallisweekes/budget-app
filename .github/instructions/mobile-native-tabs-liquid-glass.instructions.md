---
description: "Use when editing mobile Expo Router native tabs, split liquid-glass footer patterns, tab-owned action bars, or header/footer ownership in the budget app."
applyTo: "mobile-client/{app,components,navigation,lib}/**/*.{ts,tsx,js}"
---
# Mobile Native Tabs Liquid Glass Pattern

Use this instruction whenever the task mentions any of the following on mobile:

- liquid glass
- native tabs
- split footer actions
- moving actions between header and footer
- Expo Router `NativeTabs`
- route-specific footer patterns like Home / Logged / Log or Home / Projection / Add

## Source Of Truth

- In this repo, liquid-glass footer navigation should be implemented with Expo Router native tabs, not with custom in-screen overlays.
- The owning layout is usually `mobile-client/app/(tabs)/_layout.tsx`.
- If a route needs to appear as a real liquid-glass footer item, it should exist as a real tab route under `mobile-client/app/(tabs)/...`, not as a visual clone rendered inside page content.

## Required Pattern

- Prefer `NativeTabs` split layouts over custom `BlurView` footers when the user asks for the same liquid-glass pattern used elsewhere in the app.
- Keep footer actions in the footer. Do not place faux tab controls inside a hero card, page body, or scroll content when the request is clearly about footer navigation.
- Keep standard header responsibilities in `mobile-client/navigation/TabRouteHeader.tsx` unless the user explicitly asks to change the header:
  - avatar on the left for root screens
  - back chevron on drill-in screens
  - analytics/help actions on the right when those actions belong in the header
- When the user asks to move actions out of the header and into the footer, remove them from `TabRouteHeader` and re-home them in the owning native-tabs layout instead of duplicating them in both places.

## How To Implement Split Liquid Glass Footers

- Add or reuse a dedicated split branch in `mobile-client/app/(tabs)/_layout.tsx` for the affected route family.
- Use `NativeTabs.Trigger` entries for each visible footer item.
- Use `NativeTabs.Trigger.Label` and `NativeTabs.Trigger.Icon` for the repo's liquid-glass footer look.
- Use `role="search"` only when the right-side separated action should behave like the distinct trailing native action pattern.
- Keep the route tree static. Define the routes up front and switch layouts based on current segments.

## Route Ownership Rules

- If a footer item must be selectable as its own tab, create a top-level `(tabs)` route for it.
- Do not fake a footer tab by rendering a button in the page body.
- Do not solve footer navigation with a redirect loop between a tab child and a standalone screen.
- If a new top-level tab route depends on params that previously came from a nested screen, pass those params explicitly on tab press and add safe fallbacks in the consuming controller.

## Common Failure Modes To Avoid

- Wrong: adding a `BlurView` action row inside the page content because it visually resembles the footer.
- Wrong: hiding the native tab bar and replacing it with a custom absolute-positioned footer when the user asked for the existing liquid-glass native-tabs pattern.
- Wrong: moving footer actions into the page hero or card area.
- Wrong: leaving the old header actions in place after moving the behavior to the footer.
- Wrong: assuming `route.params` always exist after promoting a nested route into a top-level tab route.
- Wrong: using redirects between tab-owned routes in a way that causes update loops or remount churn.

## Practical Guidance For This Repo

- For split mobile footer work, inspect `mobile-client/app/(tabs)/_layout.tsx` first.
- For header interplay, inspect `mobile-client/navigation/TabRouteHeader.tsx` second.
- For screen content spacing, adjust the screen's own padding only after the footer ownership is correct.
- If the footer now owns actions like `Logged` or `Log`, the screen body should not render duplicate controls.
- If a screen still needs a back button, keep that in the header; footer actions are not a substitute for drill-in navigation.

## Validation

- Run `cd mobile-client && npm run typecheck` after native-tabs or route ownership changes.
- Check for runtime risks after tab-route changes:
  - missing params on first mount
  - redirect loops
  - duplicated header/footer controls
  - native tab bar hidden when it should remain visible
  - native tab bar visible when a split footer layout should own the route

## Decision Rule

- If the request says the UI should "follow the liquid glass pattern we have across the site", default to Expo Router native tabs in the layout owner.
- Only use custom `BlurView` footer UI when the user explicitly asks for a non-native custom control or when the route cannot be expressed as a native-tabs pattern.