import { NextResponse } from "next/server";

import { syncDueDirectDebitExpenses } from "@/lib/expenses/directDebit";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";
import { logNotificationDelivery } from "@/lib/push/personalization";
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  getUserNotificationPreferencesMap,
} from "@/lib/push/userNotificationPreferences";
import { sendWebPushNotification } from "@/lib/push/webPush";

export const runtime = "nodejs";

type WebPushSubscriptionDelegate = {
  deleteMany: (args: { where: { endpoint: { in: string[] } } }) => Promise<unknown>;
};

type MobilePushTokenDelegate = {
  deleteMany: (args: { where: { token: { in: string[] } } }) => Promise<unknown>;
};

type PlanNotificationSummary = {
  budgetPlanId: string;
  budgetPlanName: string;
  currency: string;
  userId: string;
  webSubscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>;
  mobileTokens: string[];
  expenseIds: string[];
  expenseNames: string[];
  totalAmount: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  const asObject = value as { toString?: () => string } | null;
  return Number(asObject?.toString?.() ?? value ?? 0);
}

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function isAuthorizedCronRequest(req: Request): boolean {
  const headerToken = req.headers.get("x-reminder-token") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const expectedReminderToken = process.env.DUE_REMINDER_TOKEN ?? "";
  const expectedCronSecret = process.env.CRON_SECRET ?? "";

  const isValidReminderToken = Boolean(expectedReminderToken) && headerToken === expectedReminderToken;
  const isValidCronSecret = Boolean(expectedCronSecret) && bearerToken === expectedCronSecret;

  return isValidReminderToken || isValidCronSecret;
}

function logCronAuthorizationFailure(req: Request): void {
  const authHeader = req.headers.get("authorization") ?? "";
  const headerToken = req.headers.get("x-reminder-token") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";
  const xVercelId = req.headers.get("x-vercel-id") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  console.warn("[direct-debit-autopay] unauthorized cron request", {
    hasCronSecretEnv: Boolean(process.env.CRON_SECRET),
    hasReminderTokenEnv: Boolean(process.env.DUE_REMINDER_TOKEN),
    hasAuthorizationHeader: Boolean(authHeader),
    hasBearerPrefix: authHeader.startsWith("Bearer "),
    bearerTokenLength: bearerToken.length,
    hasReminderHeader: Boolean(headerToken),
    reminderHeaderLength: headerToken.length,
    userAgent,
    xVercelId,
    method: req.method,
    url: req.url,
  });
}

async function handleDirectDebitAutopay(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    logCronAuthorizationFailure(req);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayIso = isoDateUTC(startOfDayUTC(now));

  const planRows = await withPrismaRetry(
    () =>
      prisma.expense.findMany({
        where: {
          isDirectDebit: true,
          isAllocation: false,
          paid: false,
        },
        select: {
          budgetPlanId: true,
        },
        distinct: ["budgetPlanId"],
      }),
    { retries: 2, delayMs: 150 },
  );

  const paidExpenseIdsByPlan = new Map<string, string[]>();

  for (const row of planRows) {
    const autoPaidExpenseIds = await syncDueDirectDebitExpenses({
      budgetPlanId: row.budgetPlanId,
      now,
      dueTodayAutoPayHour: 9,
    });

    if (autoPaidExpenseIds.length > 0) {
      paidExpenseIdsByPlan.set(row.budgetPlanId, autoPaidExpenseIds);
    }
  }

  const allPaidExpenseIds = Array.from(new Set(Array.from(paidExpenseIdsByPlan.values()).flat()));

  if (allPaidExpenseIds.length === 0) {
    return NextResponse.json({
      ok: true,
      processedPlans: planRows.length,
      autoPaidExpenseCount: 0,
      notifiedPlans: 0,
      webSent: 0,
      mobileSent: 0,
      removedWebSubscriptions: 0,
      removedMobileTokens: 0,
      mobileErrors: [],
      date: todayIso,
    });
  }

  const autoPaidExpenses = await withPrismaRetry(
    () =>
      prisma.expense.findMany({
        where: {
          id: { in: allPaidExpenseIds },
        },
        select: {
          id: true,
          name: true,
          amount: true,
          budgetPlanId: true,
          budgetPlan: {
            select: {
              id: true,
              name: true,
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
          },
        },
      }),
    { retries: 2, delayMs: 150 },
  );

  const planSummaries = new Map<string, PlanNotificationSummary>();
  for (const expense of autoPaidExpenses) {
    const existing = planSummaries.get(expense.budgetPlanId);
    if (existing) {
      existing.expenseIds.push(expense.id);
      existing.expenseNames.push(expense.name);
      existing.totalAmount += toNumber(expense.amount);
      continue;
    }

    planSummaries.set(expense.budgetPlanId, {
      budgetPlanId: expense.budgetPlan.id,
      budgetPlanName: expense.budgetPlan.name,
      currency: expense.budgetPlan.currency,
      userId: expense.budgetPlan.user.id,
      webSubscriptions: expense.budgetPlan.user.webPushSubscriptions,
      mobileTokens: expense.budgetPlan.user.mobilePushTokens.map((token) => token.token),
      expenseIds: [expense.id],
      expenseNames: [expense.name],
      totalAmount: toNumber(expense.amount),
    });
  }

  const userIds = Array.from(new Set(Array.from(planSummaries.values()).map((summary) => summary.userId)));
  const userPrefs = await getUserNotificationPreferencesMap(userIds);

  let webSent = 0;
  let mobileSent = 0;
  let notifiedPlans = 0;
  const deadEndpoints: string[] = [];
  const invalidMobileTokens: string[] = [];
  const mobileErrors: string[] = [];

  for (const summary of planSummaries.values()) {
    const prefs = userPrefs.get(summary.userId) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
    if (!prefs.paymentAlerts) continue;

    const hasWeb = summary.webSubscriptions.length > 0;
    const hasMobile = summary.mobileTokens.length > 0;
    if (!hasWeb && !hasMobile) continue;

    const paymentCount = summary.expenseIds.length;
    const amountText = money(summary.totalAmount, summary.currency || "GBP");
    const title = paymentCount === 1 ? "Direct debit payment made" : "Direct debit payments made";

    let body = "";
    if (paymentCount === 1) {
      const paymentName = summary.expenseNames[0] ?? "Your payment";
      body = `${paymentName} was paid automatically this morning (${amountText}).`;
    } else {
      const previewNames = summary.expenseNames.slice(0, 2).join(", ");
      const remainingCount = Math.max(0, paymentCount - 2);
      const nameSuffix = remainingCount > 0 ? ` and ${remainingCount} more` : "";
      body = `${paymentCount} payments were paid automatically this morning (${amountText})${previewNames ? `: ${previewNames}${nameSuffix}` : ""}.`;
    }

    let planWebSent = 0;
    let planMobileSent = 0;

    for (const subscription of summary.webSubscriptions) {
      try {
        await sendWebPushNotification({
          subscription,
          payload: {
            title,
            body,
            url: "/dashboard",
          },
        });
        planWebSent += 1;
      } catch (error: unknown) {
        const status = Number(
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode ?? 0
            : 0,
        );
        if (status === 404 || status === 410) {
          deadEndpoints.push(subscription.endpoint);
        }
      }
    }

    if (summary.mobileTokens.length > 0) {
      const mobileResult = await sendMobilePushNotifications(summary.mobileTokens, {
        title,
        body,
        data: {
          type: "direct_debit_paid",
          budgetPlanId: summary.budgetPlanId,
          expenseIds: summary.expenseIds,
          autoPaidCount: paymentCount,
          autoPaidDate: todayIso,
        },
      });
      planMobileSent += mobileResult.sent;
      invalidMobileTokens.push(...mobileResult.invalidTokens);
      mobileErrors.push(...mobileResult.errors);
    }

    if (planWebSent > 0 || planMobileSent > 0) {
      notifiedPlans += 1;
      await logNotificationDelivery({
        userId: summary.userId,
        budgetPlanId: summary.budgetPlanId,
        type: "direct_debit_paid",
        priority: "high",
        channel: planWebSent > 0 && planMobileSent > 0 ? "mixed" : planWebSent > 0 ? "web" : "mobile",
        title,
        reason: "autopay_due_date_morning",
        metadata: {
          autoPaidDate: todayIso,
          autoPaidCount: paymentCount,
          autoPaidExpenseIds: summary.expenseIds,
          autoPaidTotalAmount: summary.totalAmount,
        },
      });
    }

    webSent += planWebSent;
    mobileSent += planMobileSent;
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
    console.error("[direct-debit-autopay] mobile push errors", uniqueMobileErrors);
  }

  return NextResponse.json({
    ok: true,
    processedPlans: planRows.length,
    autoPaidExpenseCount: allPaidExpenseIds.length,
    notifiedPlans,
    webSent,
    mobileSent,
    removedWebSubscriptions: deadEndpoints.length,
    removedMobileTokens: invalidMobileTokens.length,
    mobileErrors: uniqueMobileErrors,
    date: todayIso,
  });
}

export async function GET(req: Request) {
  return handleDirectDebitAutopay(req);
}

export async function POST(req: Request) {
  return handleDirectDebitAutopay(req);
}
