import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type UserNotificationPreferences = {
  dueReminders: boolean;
  paymentAlerts: boolean;
};

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  dueReminders: true,
  paymentAlerts: true,
};

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "t") return true;
    if (v === "false" || v === "0" || v === "f") return false;
  }
  return fallback;
}

export async function getUserNotificationPreferencesMap(
  userIds: string[]
): Promise<Map<string, UserNotificationPreferences>> {
  const uniqueUserIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  const prefs = new Map<string, UserNotificationPreferences>();

  if (uniqueUserIds.length === 0) return prefs;

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      notificationDueReminders: unknown;
      notificationPaymentAlerts: unknown;
    }>>(Prisma.sql`
      SELECT
        id,
        "notificationDueReminders" as "notificationDueReminders",
        "notificationPaymentAlerts" as "notificationPaymentAlerts"
      FROM "User"
      WHERE id IN (${Prisma.join(uniqueUserIds)})
    `);

    for (const row of rows) {
      prefs.set(row.id, {
        dueReminders: toBool(
          row.notificationDueReminders,
          DEFAULT_USER_NOTIFICATION_PREFERENCES.dueReminders
        ),
        paymentAlerts: toBool(
          row.notificationPaymentAlerts,
          DEFAULT_USER_NOTIFICATION_PREFERENCES.paymentAlerts
        ),
      });
    }
  } catch {
    for (const userId of uniqueUserIds) {
      prefs.set(userId, { ...DEFAULT_USER_NOTIFICATION_PREFERENCES });
    }
  }

  return prefs;
}

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const key = userId.trim();
  if (!key) return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };

  const map = await getUserNotificationPreferencesMap([key]);
  return map.get(key) ?? { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
}
