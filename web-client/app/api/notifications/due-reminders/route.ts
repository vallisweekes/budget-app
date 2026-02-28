import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendWebPushNotification } from "@/lib/push/webPush";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  getUserNotificationPreferencesMap,
} from "@/lib/push/userNotificationPreferences";
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

function shouldSendBudgetTipOnDate(date: Date): boolean {
  const day = date.getUTCDay();
  // Mon (1), Wed (3), Fri (5) => max 3 sends/week
  return day === 1 || day === 3 || day === 5;
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
              id: true,
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
  let budgetTipMobileSent = 0;
  const deadEndpoints: string[] = [];
  const invalidMobileTokens: string[] = [];
  const mobileErrors: string[] = [];
  const debtUserIds = Array.from(new Set(debts.map((d) => d.budgetPlan.user.id)));
  const debtUserPrefs = await getUserNotificationPreferencesMap(debtUserIds);

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const userPrefs = debtUserPrefs.get(debt.budgetPlan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
    if (!userPrefs.dueReminders) continue;

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
      mobileErrors.push(...result.errors);
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
          id: true,
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

  const payDateUserIds = Array.from(new Set(payDatePlans.map((plan) => plan.user.id)));
  const payDateUserPrefs = await getUserNotificationPreferencesMap(payDateUserIds);

  for (const plan of payDatePlans) {
    const userPrefs = payDateUserPrefs.get(plan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
    if (!userPrefs.dueReminders) continue;

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
      mobileErrors.push(...result.errors);
    }
  }

  if (shouldSendBudgetTipOnDate(today)) {
    const tipPlans = await prisma.budgetPlan.findMany({
      where: {
        user: {
          mobilePushTokens: { some: {} },
        },
      },
      select: {
        id: true,
        name: true,
        currency: true,
        monthlySavingsContribution: true,
        user: {
          select: {
            id: true,
            mobilePushTokens: {
              select: {
                token: true,
              },
            },
          },
        },
      },
    });

    const tipUserIds = Array.from(new Set(tipPlans.map((plan) => plan.user.id)));
    const tipUserPrefs = await getUserNotificationPreferencesMap(tipUserIds);

    for (const plan of tipPlans) {
      const userPrefs = tipUserPrefs.get(plan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
      if (!userPrefs.paymentAlerts) continue;

      const mobileTokens = plan.user.mobilePushTokens.map((t) => t.token);
      if (mobileTokens.length === 0) continue;

      const [incomeAgg, expenseAgg, dueSoonCount] = await Promise.all([
        prisma.income.aggregate({
          where: {
            budgetPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            budgetPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
            isAllocation: false,
          },
          _sum: { amount: true },
        }),
        prisma.debt.count({
          where: {
            budgetPlanId: plan.id,
            paid: false,
            currentBalance: { gt: 0 },
            dueDate: {
              gte: today,
              lt: addDaysUTC(today, 7),
            },
          },
        }),
      ]);

      const income = Number(
        (incomeAgg._sum.amount as unknown as { toString?: () => string })?.toString?.() ?? incomeAgg._sum.amount ?? 0,
      );
      const expenses = Number(
        (expenseAgg._sum.amount as unknown as { toString?: () => string })?.toString?.() ?? expenseAgg._sum.amount ?? 0,
      );
      const savingsContribution = Number(
        (plan.monthlySavingsContribution as unknown as { toString?: () => string })?.toString?.() ??
          plan.monthlySavingsContribution ??
          0,
      );

      let title = "Budget tip";
      let body = "Keep an eye on upcoming payments and spending trends this week.";

      if (income > 0) {
        const spendingPct = Math.round((expenses / income) * 100);
        if (spendingPct >= 90) {
          title = "Spending is close to your limit";
          body = `You've used ${spendingPct}% of this month's income in ${plan.name}. Consider pausing non-essential spend.`;
        } else if (spendingPct >= 75) {
          title = "Spending trend alert";
          body = `You've used ${spendingPct}% of this month's income in ${plan.name}. Stay selective with remaining purchases.`;
        } else if (dueSoonCount >= 2) {
          title = "Upcoming debt due dates";
          body = `You have ${dueSoonCount} debt payments due within 7 days. Plan these now to avoid missed payments.`;
        } else if (savingsContribution <= 0) {
          title = "Savings habit tip";
          body = "Set a monthly savings contribution, even a small amount, to strengthen your plan over time.";
        } else {
          continue;
        }
      } else if (dueSoonCount >= 1) {
        title = "Upcoming debt due dates";
        body = `You have ${dueSoonCount} debt payment${dueSoonCount > 1 ? "s" : ""} due within 7 days.`;
      } else {
        continue;
      }

      const result = await sendMobilePushNotifications(mobileTokens, {
        title,
        body,
        data: {
          type: "budget_tip",
          budgetPlanId: plan.id,
          month: currentMonth,
          year: currentYear,
        },
      });
      budgetTipMobileSent += result.sent;
      invalidMobileTokens.push(...result.invalidTokens);
      mobileErrors.push(...result.errors);
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

  const uniqueMobileErrors = Array.from(new Set(mobileErrors));
  if (uniqueMobileErrors.length > 0) {
    console.error("[due-reminders] mobile push errors", uniqueMobileErrors);
  }

  return NextResponse.json({
    ok: true,
    sent,
    mobileSent,
    payDateReminderSent,
    payDateReminderMobileSent,
    budgetTipMobileSent,
    removedSubscriptions: deadEndpoints.length,
    removedMobileTokens: invalidMobileTokens.length,
    mobileErrors: uniqueMobileErrors,
  });
}
