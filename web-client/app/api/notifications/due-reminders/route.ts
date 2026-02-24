import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendWebPushNotification } from "@/lib/push/webPush";

export const runtime = "nodejs";

type WebPushSubscriptionDelegate = {
  deleteMany: (args: { where: { endpoint: { in: string[] } } }) => Promise<unknown>;
};

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function POST(req: Request) {
  const headerToken = req.headers.get("x-reminder-token") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const expectedReminderToken = process.env.DUE_REMINDER_TOKEN ?? "";
  const expectedCronSecret = process.env.CRON_SECRET ?? "";

  const isValidReminderToken = Boolean(expectedReminderToken) && headerToken === expectedReminderToken;
  const isValidCronSecret = Boolean(expectedCronSecret) && bearerToken === expectedCronSecret;

  if (!isValidReminderToken && !isValidCronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = startOfDayUTC(new Date());
  const inThreeDays = addDaysUTC(today, 3);

  const debts = await prisma.debt.findMany({
    where: {
      paid: false,
      currentBalance: { gt: 0 },
      dueDate: { not: null },
      budgetPlan: {
        user: {
          webPushSubscriptions: {
            some: {},
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
      budgetPlan: {
        select: {
          user: {
            select: {
              webPushSubscriptions: {
                select: {
                  endpoint: true,
                  p256dh: true,
                  auth: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  const deadEndpoints: string[] = [];

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const dueDay = startOfDayUTC(new Date(debt.dueDate));
    const dueIso = isoDateUTC(dueDay);

    let title = "";
    let body = "";

    if (isoDateUTC(dueDay) === isoDateUTC(today)) {
      title = "Debt payment due today";
      body = `${debt.name} is due today (${dueIso}).`;
    } else if (isoDateUTC(dueDay) === isoDateUTC(inThreeDays)) {
      title = "Debt payment due in 3 days";
      body = `${debt.name} is due on ${dueIso}.`;
    } else {
      continue;
    }

    const subs = debt.budgetPlan.user.webPushSubscriptions;
    for (const sub of subs) {
      try {
        await sendWebPushNotification({
          subscription: {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload: {
            title,
            body,
            url: "/dashboard",
          },
        });
        sent += 1;
      } catch (error: unknown) {
        const status = Number(
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode ?? 0
            : 0
        );
        if (status === 404 || status === 410) {
          deadEndpoints.push(sub.endpoint);
        }
      }
    }
  }

  if (deadEndpoints.length > 0) {
    const webPushSubscription = (prisma as unknown as { webPushSubscription?: WebPushSubscriptionDelegate }).webPushSubscription;
    if (webPushSubscription) {
      await webPushSubscription.deleteMany({
        where: { endpoint: { in: Array.from(new Set(deadEndpoints)) } },
      });
    }
  }

  return NextResponse.json({ ok: true, sent, removedSubscriptions: deadEndpoints.length });
}
