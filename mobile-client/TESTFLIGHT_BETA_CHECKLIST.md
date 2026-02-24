# iOS TestFlight Beta Checklist

This project is configured for EAS beta builds with profile `beta` in `eas.json`.

## 1) One-time account setup

- Enroll in Apple Developer Program.
- In App Store Connect, create the app record for bundle id `com.budgetapp.mobile`.
- In App Store Connect Users and Access, ensure your Apple ID has permission to upload builds.
- Log in locally:
  - `npx eas login`
  - `npx eas whoami`

## 2) Project sanity check

From `mobile-client` run:

- `npm install`
- `npm run doctor`
- `npm run typecheck`

## 3) Build TestFlight binary

From `mobile-client` run:

- `npm run build:ios:beta`

Notes:
- Profile `beta` uses `distribution: store` and auto-increments iOS build number.
- App version is `expo.version` in `app.json`.
- Build number is managed remotely by EAS (`appVersionSource: remote`).

## 4) Submit to TestFlight

After build completes, run:

- `npm run submit:ios:beta`

Or submit from EAS dashboard for the completed build.

## 5) App Store Connect actions

- Wait for processing (can take 5-30+ minutes).
- Complete TestFlight compliance prompts if requested.
- Add Internal Testers first.
- Optional: create External Testing group and submit Beta App Review.

## 6) Before each new beta release

- If user-facing changes are significant, bump `expo.version` in `app.json` (for example `1.0.0` -> `1.0.1`).
- Run:
  - `npm run typecheck`
  - `npm run build:ios:beta`
  - `npm run submit:ios:beta`

## Current beta-ready configuration in this repo

- `app.json`
  - `ios.bundleIdentifier = com.budgetapp.mobile`
  - `ios.config.usesNonExemptEncryption = false`
  - `runtimeVersion.policy = appVersion`
  - `updates.fallbackToCacheTimeout = 0`
- `eas.json`
  - `build.beta` profile for TestFlight store builds
  - `submit.beta` profile for iOS submission

