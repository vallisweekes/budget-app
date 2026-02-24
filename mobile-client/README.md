# Budget App — Mobile Client

React Native / Expo app that shares the **same PostgreSQL database** as `web-client` by consuming its existing `/api/bff/*` REST endpoints via the session-authenticated API client.

---

## Architecture

```
mobile-client/
├── App.tsx                    # Entry: NavigationContainer + SafeAreaProvider + Redux
├── src/
│   ├── context/
│   │   └── AuthContext.tsx    # NextAuth credentials sign-in, SecureStore session token
│   ├── lib/
│   │   ├── api.ts             # HTTP client — injects session cookie automatically
│   │   ├── apiTypes.ts        # Shared TypeScript types mirroring BFF API responses
│   │   └── storage.ts         # expo-secure-store helpers
│   ├── navigation/
│   │   ├── RootNavigator.tsx  # Login ↔ Main tabs stack
│   │   └── types.ts           # Typed navigation param lists
│   ├── screens/
│   │   ├── LoginScreen.tsx    # Username + Sign In / Register
│   │   ├── DashboardScreen.tsx
│   │   ├── ExpensesScreen.tsx # Month picker, search, paid/unpaid badges
│   │   └── SettingsScreen.tsx # Settings pulled from shared DB + sign-out
│   └── store/
│       └── index.ts           # Redux Toolkit store (typed hooks)
```

**Database access:** `mobile-client` → HTTP → `web-client /api/bff/*` → Prisma → PostgreSQL (Neon)

---

## 1. Start the web backend

```bash
cd web-client
npm install
npm run dev          # http://localhost:5537  (runs migrations + Prisma generate)
```

## 2. Configure mobile env

```bash
cd mobile-client
cp .env.example .env
```

Edit `.env`:

| Situation | Value |
|-----------|-------|
| iOS Simulator / Android Emulator (same Mac) | `EXPO_PUBLIC_API_BASE_URL=http://localhost:5537` |
| Physical device on same Wi-Fi | `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MAC_IP>:5537` |

Get your local IP on macOS:
```bash
ipconfig getifaddr en0
```

## 3. Run mobile app

```bash
npm install
npm start           # Expo DevTools — scan QR with Expo Go or press i/a for simulator
npm run ios         # iOS simulator directly
npm run android     # Android emulator directly
```

## iOS TestFlight beta

See `TESTFLIGHT_BETA_CHECKLIST.md` for the full release flow (build + submit).

---

## Auth flow

The app uses **native credential sign-in** through the existing NextAuth setup:

1. Fetches CSRF token from `/api/auth/csrf`
2. POSTs credentials to `/api/auth/callback/credentials`
3. Extracts `next-auth.session-token` from `Set-Cookie` response header
4. Stores it in `expo-secure-store` (encrypted on-device)
5. All API calls inject the token as a `Cookie` header automatically

> Sign in with the same username you use on the web app — same account, same data.

---

## Key dependencies

| Package | Purpose |
|---------|---------|
| `@react-navigation/native-stack` + `bottom-tabs` | Typed screen navigation |
| `react-native-safe-area-context` | Notch / Dynamic Island safe areas |
| `expo-secure-store` | Encrypted session token storage |
| `@reduxjs/toolkit` + `react-redux` | State management (mirrors web-client) |
| `@expo/vector-icons` | Ionicons icon set |
| `expo-constants` | Device / env metadata |
