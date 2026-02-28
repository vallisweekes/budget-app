# iOS TestFlight Beta Checklist

This project is configured for EAS beta builds with profile `beta` in `eas.json`.

## 1) One-time account setup

- Enroll in Apple Developer Program.
- In App Store Connect, create the app record for bundle id `com.budgetincheck.mobile`.
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
- App version must be `1.0.x` (Marketing Version / CFBundleShortVersionString).
  - This repo includes a committed `ios/` directory, so ensure iOS is bumped in **native** code too:
    - `ios/BudgetInCheck/Info.plist` → `CFBundleShortVersionString`
    - `ios/BudgetInCheck.xcodeproj/project.pbxproj` → `MARKETING_VERSION`
- Build number is managed remotely by EAS (`appVersionSource: remote`).

If EAS fails with “Provisioning Profile is malformed” in non-interactive mode:
- Non-interactive builds require an App Store Connect (ASC) API key to regenerate credentials.
- Fix once by running `eas credentials -p ios` interactively and letting EAS recreate the provisioning profile,
  OR add an ASC API key in EAS credentials so non-interactive builds can self-heal.

## 4) Submit to TestFlight

After build completes, run:

- `npm run submit:ios:beta`

Or submit from EAS dashboard for the completed build.

## 5) App Store Connect actions

- Wait for processing (can take 5-30+ minutes).
- Complete TestFlight compliance prompts if requested.
- Add Internal Testers first.
- Optional: create External Testing group and submit Beta App Review.

## 5.1) Privacy + compliance (required)

Before first external TestFlight review, add these in App Store Connect:

- Privacy Policy URL (must be publicly reachable over HTTPS).
  - If using this repo's web app, publish and use: `/privacy-policy` (for example `https://your-domain.com/privacy-policy`).
- App Privacy questionnaire (declare data collected/linked to user/device).
- Export compliance (this app already sets `usesNonExemptEncryption=false`, still complete prompts when asked).
- Age rating and content rights.

If your app uses account sign-in, camera, photos, or notifications, ensure your App Privacy answers reflect that.

## 5.2) Push notifications readiness

This app registers Expo push tokens (`expo-notifications`). For iOS TestFlight push to work:

- In Apple Developer -> Identifiers -> your App ID (`com.budgetincheck.mobile`), enable **Push Notifications**.
- In EAS credentials, ensure iOS push key/certs are configured (EAS can create/manage this).
- Build a new beta binary after push capability is enabled.

Notes:
- `app.json` includes `expo-notifications` plugin and iOS permission strings.
- If you changed capabilities, always submit a fresh build.

## 6) Before each new beta release

- If user-facing changes are significant, bump `expo.version` in `app.json` (for example `1.0.0` -> `1.0.1`).
- Run:
  - `npm run typecheck`
  - `npm run build:ios:beta`
  - `npm run submit:ios:beta`

## Current beta-ready configuration in this repo

- `app.json`
  - `ios.bundleIdentifier = com.budgetincheck.mobile`
  - `ios.config.usesNonExemptEncryption = false`
  - `ios.infoPlist` includes camera + photo library usage strings
  - `expo-notifications` plugin enabled
  - `runtimeVersion.policy = appVersion`
  - `updates.fallbackToCacheTimeout = 0`
- `eas.json`
  - `build.beta` profile for TestFlight store builds
  - `submit.beta` profile for iOS submission

