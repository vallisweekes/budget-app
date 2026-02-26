import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendWebPushNotification } from "@/lib/push/webPush";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";
import {
  getPlannedAmountForTarget,
  listSacrificeGoalLinks,
  listSacrificeTransferConfirmations,
} from "@/lib/income-sacrifice/goalLinks";

export const runtime = "nodejs";

type WebPushSubscriptionDelegate = {
  deleteMany: (args: { where: { endpoint: { in: string[] } } }) => Promise<unknown>;
};

type MobilePushTokenDelegate = {
  deleteMany: (args: { where: { token: { in: string[] } } }) => Promise<unknown>;
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

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
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
          OR: [
            { webPushSubscriptions: { some: {} } },
            { mobilePushTokens: { some: {} } },
          ],
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
              mobilePushTokens: {
                select: {
                  token: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let mobileSent = 0;
  let payDateReminderSent = 0;
  let payDateReminderMobileSent = 0;
  const deadEndpoints: string[] = [];
  const invalidMobileTokens: string[] = [];

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

    // Mobile push fan-out
    const mobileTokens = debt.budgetPlan.user.mobilePushTokens.map((t) => t.token);
    if (mobileTokens.length > 0) {
      const result = await sendMobilePushNotifications(mobileTokens, { title, body });
      mobileSent += result.sent;
      invalidMobileTokens.push(...result.invalidTokens);
    }
  }

  const currentMonth = today.getUTCMonth() + 1;
  const currentYear = today.getUTCFullYear();
  const todayDay = today.getUTCDate();

  const payDatePlans = await prisma.budgetPlan.findMany({
    where: {
      payDate: todayDay,
      user: {
        OR: [
          { webPushSubscriptions: { some: {} } },
          { mobilePushTokens: { some: {} } },
        ],
      },
    },
    select: {
      id: true,
      currency: true,
      user: {
        select: {
          webPushSubscriptions: {
            select: {
              endpoint: true,
              p256dh: true,
              auth: true,
            },
          },
          mobilePushTokens: {
            select: {
              token: true,
            },
          },
        },
      },
    },
  });

  for (const plan of payDatePlans) {
    const links = await listSacrificeGoalLinks(plan.id);
    if (links.length === 0) continue;

    const confirmations = await listSacrificeTransferConfirmations({
      budgetPlanId: plan.id,
      year: currentYear,
      month: currentMonth,
    });
    const confirmedByTarget = new Set(confirmations.map((row) => row.targetKey));

    const pendingRows = await Promise.all(
      links
        .filter((link) => !confirmedByTarget.has(link.targetKey))
        .map(async (link) => ({
          targetKey: link.targetKey,
          amount: await getPlannedAmountForTarget({
            budgetPlanId: plan.id,
            year: currentYear,
            month: currentMonth,
            targetKey: link.targetKey,
          }),
        })),
    );

    const pendingTotal = pendingRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    if (pendingTotal <= 0) continue;

    const title = "Confirm your income sacrifice";
    const body = `You still have ${money(pendingTotal, plan.currency || "GBP")} to confirm for this month. Confirm transfers to update your goals.`;

    for (const sub of plan.user.webPushSubscriptions) {
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
        payDateReminderSent += 1;
      } catch (error: unknown) {
        const status = Number(
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode ?? 0
            : 0,
        );
        if (status === 404 || status === 410) {
          deadEndpoints.push(sub.endpoint);
        }
      }
    }

    const mobileTokens = plan.user.mobilePushTokens.map((t) => t.token);
    if (mobileTokens.length > 0) {
      const result = await sendMobilePushNotifications(mobileTokens, {
        title,
        body,
        data: {
          type: "income_sacrifice_reminder",
          month: currentMonth,
          year: currentYear,
          budgetPlanId: plan.id,
        },
      });
      payDateReminderMobileSent += result.sent;
      invalidMobileTokens.push(...result.invalidTokens);
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

  if (invalidMobileTokens.length > 0) {
    const mobilePushToken = (prisma as unknown as { mobilePushToken?: MobilePushTokenDelegate }).mobilePushToken;
    if (mobilePushToken) {
      await mobilePushToken.deleteMany({
        where: { token: { in: Array.from(new Set(invalidMobileTokens)) } },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    mobileSent,
    payDateReminderSent,
    payDateReminderMobileSent,
    removedSubscriptions: deadEndpoints.length,
    removedMobileTokens: invalidMobileTokens.length,
  });
}
