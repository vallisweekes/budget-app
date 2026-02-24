# Due Reminders Handoff

This note tracks the current due-reminder implementation so we can resume later quickly.

## Current state

- Endpoint exists: `/api/notifications/due-reminders`
  - File: `app/api/notifications/due-reminders/route.ts`
- It sends web push reminders for debts with `dueDate` and positive balance:
  - On due date
  - 3 days before due date
- It reads user web push subscriptions from `WebPushSubscription`.
- It prunes dead subscriptions on `404/410` push responses.

## Auth options

Endpoint currently accepts either:

1. `Authorization: Bearer <CRON_SECRET>` (recommended for Vercel Cron)
2. `x-reminder-token: <DUE_REMINDER_TOKEN>` (manual webhook/testing)

## Scheduler setup

- `vercel.json` added with daily cron at `08:00 UTC`:
  - Path: `/api/notifications/due-reminders`
  - Schedule: `0 8 * * *`

## Required env vars

- `CRON_SECRET` (recommended)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- Optional fallback/manual: `DUE_REMINDER_TOKEN`

## Data dependencies

- Debt model supports `dueDate` and missed-payment accrual via 5-day grace logic.
- Debt BFF routes now persist `dueDate` on create/update.

## Follow-up ideas (not yet implemented)

- Add mobile-native push reminders for mobile app users (Expo notifications path).
- Add user-level reminder preferences (enable/disable, timing).
- Add a test endpoint or admin preview to simulate reminders safely.
- Add idempotency log table if needed for strict once-per-day guarantees per debt.
