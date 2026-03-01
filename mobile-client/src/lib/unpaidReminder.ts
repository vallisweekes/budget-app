import { apiFetch } from "@/lib/api";

type UnpaidReminderResponse = {
  tip?: string | null;
  reminderTitle?: string | null;
  reminderBody?: string | null;
  remindAt?: string | null;
  remindInDays?: number | null;
};

type PaymentStatusMessageResponse = {
  title?: string | null;
  body?: string | null;
};

type PaymentStatus = "paid" | "unpaid";

async function tryGetNotifications() {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

function fallbackReminder(params: { expenseName: string }): { title: string; body: string } {
  const name = String(params.expenseName ?? "").trim() || "this payment";
  return {
    title: `Reminder: ${name}`,
    body: `You marked ${name} as unpaid. Review and mark it paid when done.`,
  };
}

function pickRandom<T>(values: readonly T[]): T {
  const idx = Math.floor(Math.random() * values.length);
  return values[Math.max(0, Math.min(values.length - 1, idx))] as T;
}

const PAID_TITLES = [
  "Sorted — bill paid",
  "Nice one — payment done",
  "All sorted",
] as const;

const PAID_BODIES = [
  "{expense} is sorted. Your monthly budget has a bit more breathing room.",
  "{expense} is paid off — lovely. That's one less thing nibbling at your budget.",
  "You got {expense} done. Your budget pot looks healthier already.",
] as const;

const UNPAID_TITLES = [
  "Marked unpaid",
  "Back to unpaid",
  "Unpaid for now",
] as const;

const UNPAID_BODIES = [
  "{expense} is now unpaid. Leave it too long and it can squeeze your monthly budget.",
  "{expense} is unpaid again. Keep tabs on it so it doesn't drift into debt.",
  "{expense} is currently unpaid. That can tighten your budget if it stays open.",
] as const;

function fillExpense(template: string, expenseName: string): string {
  return template.replaceAll("{expense}", expenseName);
}

function parseDueDay(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const iso = String(dueDate).length >= 10 ? String(dueDate).slice(0, 10) : String(dueDate);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isCurrentViewedMonth(month: number, year: number): boolean {
  const now = new Date();
  return month === now.getMonth() + 1 && year === now.getFullYear();
}

function followUpDateForDayOffset(offset: number): Date {
  const base = new Date();
  base.setDate(base.getDate() + offset);
  base.setHours(18, 0, 0, 0);
  return base;
}

function hasPermission(settings: any, Notifications: any): boolean {
  if (settings?.granted === true) return true;
  const iosStatus = settings?.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function scheduleUnpaidReminder(params: {
  expenseId: string;
  expenseName: string;
}): Promise<void> {
  const reminder = await apiFetch<UnpaidReminderResponse>(`/api/bff/expenses/${encodeURIComponent(params.expenseId)}/unpaid-reminder`, {
    method: "POST",
    body: {},
    cacheTtlMs: 0,
    skipOnUnauthorized: true,
  }).catch(() => null);

  const Notifications = await tryGetNotifications();
  if (!Notifications) return;

  let settings = await Notifications.getPermissionsAsync();
  if (!hasPermission(settings, Notifications)) {
    settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });
  }
  if (!hasPermission(settings, Notifications)) return;

  const fallback = fallbackReminder({ expenseName: params.expenseName });
  const title = String(reminder?.reminderTitle ?? "").trim() || fallback.title;
  const body = String(reminder?.reminderBody ?? "").trim() || fallback.body;

  const rawRemindAt = reminder?.remindAt ? new Date(reminder.remindAt) : null;
  const remindAt = rawRemindAt && !Number.isNaN(rawRemindAt.getTime())
    ? rawRemindAt
    : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    })();

  const triggerAt = remindAt.getTime() > Date.now() + 30_000
    ? remindAt
    : new Date(Date.now() + 60_000);
  const secondsUntilReminder = Math.max(60, Math.round((triggerAt.getTime() - Date.now()) / 1000));

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: {
        type: "expense-unpaid-reminder",
        expenseId: params.expenseId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilReminder,
      repeats: false,
    },
  });
}

export async function notifyPaymentStatus(params: {
  expenseId: string;
  status: PaymentStatus;
  expenseName: string;
}): Promise<void> {
  const Notifications = await tryGetNotifications();
  if (!Notifications) return;

  let settings = await Notifications.getPermissionsAsync();
  if (!hasPermission(settings, Notifications)) {
    settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });
  }
  if (!hasPermission(settings, Notifications)) return;

  const fallbackTitle = params.status === "paid"
    ? pickRandom(PAID_TITLES)
    : pickRandom(UNPAID_TITLES);
  const fallbackBody = fillExpense(
    params.status === "paid" ? pickRandom(PAID_BODIES) : pickRandom(UNPAID_BODIES),
    String(params.expenseName ?? "this expense")
  );

  const aiMessage = await apiFetch<PaymentStatusMessageResponse>(
    `/api/bff/expenses/${encodeURIComponent(params.expenseId)}/payment-status-message`,
    {
      method: "POST",
      body: { status: params.status },
      cacheTtlMs: 0,
      skipOnUnauthorized: true,
    }
  ).catch(() => null);

  const title = String(aiMessage?.title ?? "").trim() || fallbackTitle;
  const body = String(aiMessage?.body ?? "").trim() || fallbackBody;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: {
        type: "expense-payment-status",
        status: params.status,
      },
    },
    trigger: null,
  });
}

export async function scheduleUnpaidFollowUpReminders(params: {
  expenseId: string;
  expenseName: string;
  dueDate: string | null | undefined;
  month: number;
  year: number;
  wasPreviouslyPaid: boolean;
}): Promise<void> {
  if (!params.wasPreviouslyPaid) return;
  if (!isCurrentViewedMonth(params.month, params.year)) return;

  const dueDayDelta = parseDueDay(params.dueDate);
  if (dueDayDelta == null || dueDayDelta > 0) return;

  const Notifications = await tryGetNotifications();
  if (!Notifications) return;

  let settings = await Notifications.getPermissionsAsync();
  if (!hasPermission(settings, Notifications)) {
    settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });
  }
  if (!hasPermission(settings, Notifications)) return;

  const reminder = await apiFetch<UnpaidReminderResponse>(`/api/bff/expenses/${encodeURIComponent(params.expenseId)}/unpaid-reminder`, {
    method: "POST",
    body: {},
    cacheTtlMs: 0,
    skipOnUnauthorized: true,
  }).catch(() => null);

  const prefix = String(reminder?.tip ?? "").trim() || `Reminder for ${params.expenseName}: still unpaid.`;
  const baseTitle = String(reminder?.reminderTitle ?? "").trim() || `Reminder: ${params.expenseName}`;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((item: any) => {
    const data = item?.content?.data as Record<string, unknown> | undefined;
    return data?.type === "expense-unpaid-followup" && data?.expenseId === params.expenseId;
  });
  await Promise.all(toCancel.map((item: any) => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  const now = Date.now();
  for (const offset of [2, 3, 4, 5]) {
    const when = followUpDateForDayOffset(offset);
    if (when.getTime() <= now + 30_000) continue;

    const body = `${prefix} Day ${offset}: still unpaid can reduce your monthly budget and increase debt pressure.`;
    const seconds = Math.max(60, Math.round((when.getTime() - now) / 1000));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: baseTitle,
        body,
        sound: "default",
        data: {
          type: "expense-unpaid-followup",
          expenseId: params.expenseId,
          day: offset,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  }
}
