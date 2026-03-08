import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NotificationPriority = "high" | "low";
export type NotificationChannel = "web" | "mobile" | "mixed";

export type UserNotificationPersonalization = {
  userId: string;
  lastSentAt: Date | null;
  lastLowPrioritySentAt: Date | null;
  recentSendCount7d: number;
  lastActiveAt: Date | null;
  daysSinceLastActive: number | null;
  preferredSendHour: number | null;
};

type DeliverySummaryRow = {
  userId: string;
  lastSentAt: Date | string | null;
  lastLowPrioritySentAt: Date | string | null;
  recentSendCount7d: number | bigint | string | null;
};

type ActivitySummaryRow = {
  userId: string;
  lastActiveAt: Date | string | null;
  preferredSendHour: number | bigint | string | null;
};

function uniqueUserIds(userIds: string[]): string[] {
  return Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)));
}

function tableMissing(error: unknown, tableName: string): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return message.includes(tableName) || message.includes("P2021") || message.includes("does not exist");
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInt(value: number | bigint | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

export function defaultUserNotificationPersonalization(userId: string): UserNotificationPersonalization {
  return {
    userId,
    lastSentAt: null,
    lastLowPrioritySentAt: null,
    recentSendCount7d: 0,
    lastActiveAt: null,
    daysSinceLastActive: null,
    preferredSendHour: null,
  };
}

export function canSendLowPriorityNotification(
  personalization: UserNotificationPersonalization,
  now: Date,
  cooldownDays = 3,
): boolean {
  const lastLowPrioritySentAt = personalization.lastLowPrioritySentAt;
  if (lastLowPrioritySentAt) {
    const elapsed = now.getTime() - lastLowPrioritySentAt.getTime();
    if (elapsed < cooldownDays * DAY_MS) return false;
  }

  return personalization.recentSendCount7d < 3;
}

export function getPersonalizationContext(personalization: UserNotificationPersonalization): Record<string, unknown> {
  return {
    daysSinceLastActive: personalization.daysSinceLastActive,
    preferredSendHour: personalization.preferredSendHour,
    recentSendCount7d: personalization.recentSendCount7d,
    lastSentAt: personalization.lastSentAt?.toISOString() ?? null,
    lastActiveAt: personalization.lastActiveAt?.toISOString() ?? null,
  };
}

export async function getUserNotificationPersonalizationMap(
  userIds: string[],
  now: Date,
): Promise<Map<string, UserNotificationPersonalization>> {
  const ids = uniqueUserIds(userIds);
  const map = new Map<string, UserNotificationPersonalization>();

  for (const userId of ids) {
    map.set(userId, defaultUserNotificationPersonalization(userId));
  }

  if (ids.length === 0) return map;

  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  try {
    const deliveryRows = await withPrismaRetry(() => prisma.$queryRaw<Array<DeliverySummaryRow>>(Prisma.sql`
      SELECT
        "userId",
        MAX("sentAt") AS "lastSentAt",
        MAX(CASE WHEN "priority" = 'low' THEN "sentAt" ELSE NULL END) AS "lastLowPrioritySentAt",
        CAST(COUNT(*) FILTER (WHERE "sentAt" >= ${sevenDaysAgo}) AS INTEGER) AS "recentSendCount7d"
      FROM "NotificationDelivery"
      WHERE "userId" IN (${Prisma.join(ids)})
      GROUP BY "userId"
    `), { retries: 2, delayMs: 150 });

    for (const row of deliveryRows) {
      const current = map.get(row.userId) ?? defaultUserNotificationPersonalization(row.userId);
      current.lastSentAt = toDate(row.lastSentAt);
      current.lastLowPrioritySentAt = toDate(row.lastLowPrioritySentAt);
      current.recentSendCount7d = toInt(row.recentSendCount7d);
      map.set(row.userId, current);
    }
  } catch (error) {
    if (!tableMissing(error, "NotificationDelivery")) throw error;
  }

  try {
    const activityRows = await withPrismaRetry(() => prisma.$queryRaw<Array<ActivitySummaryRow>>(Prisma.sql`
      SELECT
        "userId",
        MAX("lastSeenAt") AS "lastActiveAt",
        CAST(ROUND(AVG(EXTRACT(HOUR FROM "lastSeenAt"))) AS INTEGER) AS "preferredSendHour"
      FROM "MobileAuthSession"
      WHERE "userId" IN (${Prisma.join(ids)})
        AND "revokedAt" IS NULL
        AND "lastSeenAt" >= ${thirtyDaysAgo}
      GROUP BY "userId"
    `), { retries: 2, delayMs: 150 });

    for (const row of activityRows) {
      const current = map.get(row.userId) ?? defaultUserNotificationPersonalization(row.userId);
      current.lastActiveAt = toDate(row.lastActiveAt);
      current.preferredSendHour = toInt(row.preferredSendHour);
      current.daysSinceLastActive = current.lastActiveAt
        ? Math.max(0, Math.floor((now.getTime() - current.lastActiveAt.getTime()) / DAY_MS))
        : null;
      map.set(row.userId, current);
    }
  } catch (error) {
    if (!tableMissing(error, "MobileAuthSession")) throw error;
  }

  return map;
}

export async function logNotificationDelivery(input: {
  userId: string;
  budgetPlanId?: string | null;
  type: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  title: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  sentAt?: Date;
}): Promise<void> {
  try {
    await withPrismaRetry(() => prisma.$executeRaw(Prisma.sql`
      INSERT INTO "NotificationDelivery" (
        "id",
        "userId",
        "budgetPlanId",
        "type",
        "priority",
        "channel",
        "title",
        "reason",
        "metadataJson",
        "sentAt",
        "createdAt"
      ) VALUES (
        ${randomUUID()},
        ${input.userId},
        ${input.budgetPlanId ?? null},
        ${input.type},
        ${input.priority},
        ${input.channel},
        ${input.title},
        ${input.reason ?? null},
        ${input.metadata ? JSON.stringify(input.metadata) : null},
        ${input.sentAt ?? new Date()},
        ${new Date()}
      )
    `), { retries: 2, delayMs: 150 });
  } catch (error) {
    if (!tableMissing(error, "NotificationDelivery")) throw error;
  }
}