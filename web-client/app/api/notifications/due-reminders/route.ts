import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";
import { sendWebPushNotification } from "@/lib/push/webPush";
import { sendMobilePushNotifications } from "@/lib/push/mobilePush";
import { maybeGeneratePushCopy } from "@/lib/push/aiCopy";
import {
  canSendLowPriorityNotification,
  getPersonalizationContext,
  getUserNotificationPersonalizationMap,
  logNotificationDelivery,
} from "@/lib/push/personalization";
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

type SentPushSummary = {
  webSent: number;
  mobileSent: number;
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
  void date;
  return true;
}

function hasMeaningfulOnboardingProgress(profile: {
  occupation?: string | null;
  occupationOther?: string | null;
  payDay?: number | null;
  payFrequency?: string | null;
  billFrequency?: string | null;
  monthlySalary?: unknown;
  planningYears?: number | null;
  mainGoal?: string | null;
  mainGoals?: string[] | null;
  hasAllowance?: boolean | null;
  hasDebtsToManage?: boolean | null;
}): boolean {
  const monthlySalary = Number(
    (profile.monthlySalary as { toString?: () => string } | null | undefined)?.toString?.() ?? profile.monthlySalary ?? 0,
  );
  return Boolean(
    profile.occupation ||
      profile.occupationOther ||
      profile.payDay ||
      profile.payFrequency ||
      profile.billFrequency ||
      profile.planningYears ||
      profile.mainGoal ||
      (Array.isArray(profile.mainGoals) && profile.mainGoals.length > 0) ||
      monthlySalary > 0 ||
      profile.hasAllowance !== null ||
      profile.hasDebtsToManage !== null,
  );
}

async function sendLoggedNotifications(params: {
  userId: string;
  budgetPlanId?: string | null;
  type: string;
  priority: "high" | "low";
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  title: string;
  body?: string;
  url?: string;
  webSubscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>;
  mobileTokens: string[];
  deadEndpoints: string[];
  invalidMobileTokens: string[];
  mobileErrors: string[];
  mobileData?: Record<string, unknown>;
}): Promise<SentPushSummary> {
  let webSent = 0;
  let mobileSent = 0;

  for (const sub of params.webSubscriptions) {
    try {
      await sendWebPushNotification({
        subscription: {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        payload: {
          title: params.title,
          body: params.body,
          url: params.url ?? "/dashboard",
        },
      });
      webSent += 1;
    } catch (error: unknown) {
      const status = Number(
        typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode ?? 0
          : 0,
      );
      if (status === 404 || status === 410) {
        params.deadEndpoints.push(sub.endpoint);
      }
    }
  }

  if (params.mobileTokens.length > 0) {
    const result = await sendMobilePushNotifications(params.mobileTokens, {
      title: params.title,
      body: params.body,
      data: params.mobileData,
    });
    mobileSent += result.sent;
    params.invalidMobileTokens.push(...result.invalidTokens);
    params.mobileErrors.push(...result.errors);
  }

  if (webSent > 0 || mobileSent > 0) {
    await logNotificationDelivery({
      userId: params.userId,
      budgetPlanId: params.budgetPlanId ?? null,
      type: params.type,
      priority: params.priority,
      channel: webSent > 0 && mobileSent > 0 ? "mixed" : webSent > 0 ? "web" : "mobile",
      title: params.title,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    });
  }

  return { webSent, mobileSent };
}

const DAILY_FALLBACK_TIPS = [
  "Quick win: check one upcoming payment today so nothing sneaks up on your budget.",
  "Tiny habit, big impact: review one category and trim just one expense this week.",
  "Recurring-charge check: cancel or pause one subscription you no longer use.",
  "Tip of the day: mark paid items promptly to keep your budget totals accurate.",
  "Debt momentum: add a small extra payment to your highest-interest balance this week.",
  "Stay ahead: scan debts due soon and plan one payment now.",
] as const;

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

async function runHighFrequencyTestPush(now: Date): Promise<NextResponse> {
  const enabled = process.env.ENABLE_NOTIFICATION_TEST_CRON === "1";
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      testMode: true,
      skipped: true,
      reason: "ENABLE_NOTIFICATION_TEST_CRON is not enabled",
    });
  }

  const bucket = Math.floor(now.getTime() / (5 * 60 * 1000));
  const variant: "tip" | "upcoming_payment" = bucket % 2 === 0 ? "tip" : "upcoming_payment";

  const invalidMobileTokens: string[] = [];
  const mobileErrors: string[] = [];
  let sent = 0;

  if (variant === "tip") {
    const tipPlans = await withPrismaRetry(() => prisma.budgetPlan.findMany({
      where: {
        user: {
          mobilePushTokens: { some: {} },
        },
      },
      select: {
        id: true,
        name: true,
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
    }), { retries: 2, delayMs: 150 });

    const tipUserIds = Array.from(new Set(tipPlans.map((plan) => plan.user.id)));
    const tipUserPrefs = await getUserNotificationPreferencesMap(tipUserIds);
    const sentUsers = new Set<string>();

    for (const plan of tipPlans) {
      if (sentUsers.has(plan.user.id)) continue;

      const userPrefs = tipUserPrefs.get(plan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
      if (!userPrefs.dailyTips) continue;

      const mobileTokens = plan.user.mobilePushTokens.map((t) => t.token);
      if (mobileTokens.length === 0) continue;

      const result = await sendMobilePushNotifications(mobileTokens, {
        title: "Budget tip (test)",
        body: `Testing reminders: quick planning check for ${plan.name}.`,
        data: {
          type: "budget_tip_test",
          budgetPlanId: plan.id,
          sentAt: now.toISOString(),
        },
      });
      sent += result.sent;
      invalidMobileTokens.push(...result.invalidTokens);
      mobileErrors.push(...result.errors);
      sentUsers.add(plan.user.id);
    }
  } else {
    const today = startOfDayUTC(now);
    const inSevenDays = addDaysUTC(today, 7);

    const debts = await withPrismaRetry(() => prisma.debt.findMany({
      where: {
        paid: false,
        currentBalance: { gt: 0 },
        dueDate: {
          not: null,
          gte: today,
          lt: inSevenDays,
        },
        budgetPlan: {
          user: {
            mobilePushTokens: { some: {} },
          },
        },
      },
      orderBy: {
        dueDate: "asc",
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
    }), { retries: 2, delayMs: 150 });

    const debtUserIds = Array.from(new Set(debts.map((debt) => debt.budgetPlan.user.id)));
    const debtUserPrefs = await getUserNotificationPreferencesMap(debtUserIds);
    const sentUsers = new Set<string>();

    for (const debt of debts) {
      const userId = debt.budgetPlan.user.id;
      if (sentUsers.has(userId)) continue;

      const userPrefs = debtUserPrefs.get(userId) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
      if (!userPrefs.dueReminders) continue;

      const mobileTokens = debt.budgetPlan.user.mobilePushTokens.map((t) => t.token);
      if (mobileTokens.length === 0) continue;

      const due = debt.dueDate ? isoDateUTC(startOfDayUTC(new Date(debt.dueDate))) : "soon";
    const fallbackTitle = "Upcoming payment";
    const fallbackBody = `${debt.name} is due on ${due}.`;
    const copy = await maybeGeneratePushCopy({
      event: "upcoming_payment_test",
      context: {
        kind: "debt",
        name: debt.name,
        dueDate: due,
        tone: "calm, not scary",
      },
      fallback: { title: fallbackTitle, body: fallbackBody },
    });
      const result = await sendMobilePushNotifications(mobileTokens, {
    title: copy.title,
    body: copy.body,
        data: {
          type: "upcoming_payment_test",
          debtId: debt.id,
          dueDate: due,
          sentAt: now.toISOString(),
        },
      });
      sent += result.sent;
      invalidMobileTokens.push(...result.invalidTokens);
      mobileErrors.push(...result.errors);
      sentUsers.add(userId);
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
    console.error("[due-reminders:test-mode] mobile push errors", uniqueMobileErrors);
  }

  return NextResponse.json({
    ok: true,
    testMode: true,
    variant,
    sent,
    removedMobileTokens: invalidMobileTokens.length,
    mobileErrors: uniqueMobileErrors,
  });
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

  console.warn("[due-reminders] unauthorized cron request", {
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

async function handleDueReminders(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    logCronAuthorizationFailure(req);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const isTestMode = url.searchParams.get("testMode") === "1";
  if (isTestMode) {
    return runHighFrequencyTestPush(new Date());
  }

  const today = startOfDayUTC(new Date());
  const inThreeDays = addDaysUTC(today, 3);

  const debts = await withPrismaRetry(() => prisma.debt.findMany({
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
  }), { retries: 2, delayMs: 150 });

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
  const debtUserPersonalization = await getUserNotificationPersonalizationMap(debtUserIds, today);

  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const userPrefs = debtUserPrefs.get(debt.budgetPlan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
    if (!userPrefs.dueReminders) continue;

    const dueDay = startOfDayUTC(new Date(debt.dueDate));
    const dueIso = isoDateUTC(dueDay);

    let title = "";
    let body = "";
    let dueInDays: number | null = null;

    if (isoDateUTC(dueDay) === isoDateUTC(today)) {
    title = "Payment due today";
    body = `${debt.name} is due today (${dueIso}). You’re on top of it.`;
    dueInDays = 0;
    } else if (isoDateUTC(dueDay) === isoDateUTC(inThreeDays)) {
    title = "Payment coming up";
    body = `${debt.name} is due on ${dueIso}. A quick check now keeps things smooth.`;
    dueInDays = 3;
    } else {
      continue;
    }

  const copy = await maybeGeneratePushCopy({
    event: "debt_due_reminder",
    context: {
      kind: "debt",
      name: debt.name,
      dueDate: dueIso,
      dueInDays,
      tone: "calm, not scary",
      ...getPersonalizationContext(
        debtUserPersonalization.get(debt.budgetPlan.user.id) ?? {
          userId: debt.budgetPlan.user.id,
          lastSentAt: null,
          lastLowPrioritySentAt: null,
          recentSendCount7d: 0,
          lastActiveAt: null,
          daysSinceLastActive: null,
          preferredSendHour: null,
        },
      ),
    },
    fallback: { title, body },
  });
  title = copy.title;
  body = copy.body ?? body;

    const sentSummary = await sendLoggedNotifications({
      userId: debt.budgetPlan.user.id,
      budgetPlanId: null,
      type: "debt_due_reminder",
      priority: "high",
      reason: dueInDays === 0 ? "due_today" : "due_in_3_days",
      metadata: { debtId: debt.id, dueDate: dueIso, dueInDays },
      title,
      body,
      url: "/dashboard",
      webSubscriptions: debt.budgetPlan.user.webPushSubscriptions,
      mobileTokens: debt.budgetPlan.user.mobilePushTokens.map((t) => t.token),
      deadEndpoints,
      invalidMobileTokens,
      mobileErrors,
      mobileData: {
        type: "debt_due_reminder",
        debtId: debt.id,
        dueDate: dueIso,
        dueInDays,
      },
    });
    sent += sentSummary.webSent;
    mobileSent += sentSummary.mobileSent;
  }

  const currentMonth = today.getUTCMonth() + 1;
  const currentYear = today.getUTCFullYear();
  const todayDay = today.getUTCDate();

  const payDatePlans = await withPrismaRetry(() => prisma.budgetPlan.findMany({
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
  }), { retries: 2, delayMs: 150 });

  const payDateUserIds = Array.from(new Set(payDatePlans.map((plan) => plan.user.id)));
  const payDateUserPrefs = await getUserNotificationPreferencesMap(payDateUserIds);
  const payDateUserPersonalization = await getUserNotificationPersonalizationMap(payDateUserIds, today);

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

  const pendingTotalText = money(pendingTotal, plan.currency || "GBP");
    const title = "Confirm your income sacrifice";
    const body = `You still have ${pendingTotalText} to confirm for this month. Confirm transfers to update your goals.`;

  const copy = await maybeGeneratePushCopy({
    event: "income_sacrifice_reminder",
    context: {
      kind: "expense",
      budgetPlanName: plan.name,
      pendingTotal,
      pendingTotalText,
      month: currentMonth,
      year: currentYear,
      tone: "supportive, organised",
      ...getPersonalizationContext(
        payDateUserPersonalization.get(plan.user.id) ?? {
          userId: plan.user.id,
          lastSentAt: null,
          lastLowPrioritySentAt: null,
          recentSendCount7d: 0,
          lastActiveAt: null,
          daysSinceLastActive: null,
          preferredSendHour: null,
        },
      ),
    },
    fallback: { title, body },
  });

    const payDateSentSummary = await sendLoggedNotifications({
      userId: plan.user.id,
      budgetPlanId: plan.id,
      type: "income_sacrifice_reminder",
      priority: "high",
      reason: "payday_pending_transfers",
      metadata: {
        month: currentMonth,
        year: currentYear,
        pendingTotal,
        pendingTotalText,
      },
      title: copy.title,
      body: copy.body,
      url: "/dashboard",
      webSubscriptions: plan.user.webPushSubscriptions,
      mobileTokens: plan.user.mobilePushTokens.map((t) => t.token),
      deadEndpoints,
      invalidMobileTokens,
      mobileErrors,
      mobileData: {
        type: "income_sacrifice_reminder",
        month: currentMonth,
        year: currentYear,
        budgetPlanId: plan.id,
      },
    });
    payDateReminderSent += payDateSentSummary.webSent;
    payDateReminderMobileSent += payDateSentSummary.mobileSent;
  }

  if (shouldSendBudgetTipOnDate(today)) {
    const tipPlans = await withPrismaRetry(() => prisma.budgetPlan.findMany({
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
    }), { retries: 2, delayMs: 150 });

    const tipUserIds = Array.from(new Set(tipPlans.map((plan) => plan.user.id)));
    const tipUserPrefs = await getUserNotificationPreferencesMap(tipUserIds);
    const tipUserPersonalization = await getUserNotificationPersonalizationMap(tipUserIds, today);

    for (const plan of tipPlans) {
      const userPrefs = tipUserPrefs.get(plan.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
      if (!userPrefs.dailyTips) continue;

      const personalization = tipUserPersonalization.get(plan.user.id);
      if (!personalization || !canSendLowPriorityNotification(personalization, today, 3)) continue;

      const mobileTokens = plan.user.mobilePushTokens.map((t) => t.token);
      if (mobileTokens.length === 0) continue;

      const [incomeAgg, expenseAgg, dueSoonCount, debtAgg, recurringCharges] = await Promise.all([
        withPrismaRetry(() => prisma.income.aggregate({
          where: {
            budgetPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
          },
          _sum: { amount: true },
        }), { retries: 2, delayMs: 150 }),
        withPrismaRetry(() => prisma.expense.aggregate({
          where: {
            budgetPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
            isAllocation: false,
          },
          _sum: { amount: true },
        }), { retries: 2, delayMs: 150 }),
        withPrismaRetry(() => prisma.debt.count({
          where: {
            budgetPlanId: plan.id,
            paid: false,
            currentBalance: { gt: 0 },
            dueDate: {
              gte: today,
              lt: addDaysUTC(today, 7),
            },
          },
        }), { retries: 2, delayMs: 150 }),
        withPrismaRetry(() => prisma.debt.aggregate({
          where: {
            budgetPlanId: plan.id,
            paid: false,
            currentBalance: { gt: 0 },
          },
          _sum: { currentBalance: true },
          _count: { id: true },
        }), { retries: 2, delayMs: 150 }),
        withPrismaRetry(() => prisma.expense.findMany({
          where: {
            budgetPlanId: plan.id,
            month: currentMonth,
            year: currentYear,
            isAllocation: false,
            isDirectDebit: true,
          },
          select: {
            name: true,
            amount: true,
          },
          orderBy: {
            amount: "desc",
          },
          take: 8,
        }), { retries: 2, delayMs: 150 }),
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
      const totalDebtBalance = Number(
        (debtAgg._sum.currentBalance as unknown as { toString?: () => string })?.toString?.() ?? debtAgg._sum.currentBalance ?? 0,
      );
      const activeDebtCount = Number(debtAgg._count.id ?? 0);
      const recurringChargeCandidates = Array.from(
        new Map(
          recurringCharges
            .map((row) => {
              const name = String(row.name ?? "").trim();
              if (!name) return null;
              const amount = Number((row.amount as unknown as { toString?: () => string })?.toString?.() ?? row.amount ?? 0);
              return [name.toLowerCase(), { name, amount: Number.isFinite(amount) ? amount : 0 }] as const;
            })
            .filter((row): row is readonly [string, { name: string; amount: number }] => Boolean(row)),
        ).values(),
      ).slice(0, 3);

      let title = "Budget tip";
      let body = "Keep an eye on upcoming payments and spending trends this week.";
  		let reason: string | null = null;

      if (income > 0) {
        const spendingPct = Math.round((expenses / income) * 100);
        if (spendingPct >= 90) {
          title = "Spending is close to your limit";
          body = `You’ve used about ${spendingPct}% of this month’s income in ${plan.name}. You’re in a good place—want a quick review?`;
      reason = "spending_90";
        } else if (spendingPct >= 75) {
          title = "Spending trend alert";
      body = `You’ve used about ${spendingPct}% of this month’s income in ${plan.name}. Nice tracking—keep it steady.`;
      reason = "spending_75";
        } else if (dueSoonCount >= 2) {
          title = "Upcoming debt due dates";
      body = `You have ${dueSoonCount} payments due within 7 days. A quick plan now keeps things smooth.`;
      reason = "due_soon";
        } else if (activeDebtCount > 0 && totalDebtBalance > 0) {
          title = "Debt momentum tip";
          body = "Add a small extra payment to one debt this week to speed up payoff and free cash sooner.";
          reason = "debt_accelerate";
        } else if (recurringChargeCandidates.length >= 2) {
          title = "Recurring charge check";
          body = "Review your recurring charges and cancel one you no longer use to free up monthly cash.";
          reason = "subscription_review";
        } else if (savingsContribution <= 0) {
          title = "Savings habit tip";
          body = "Set a monthly savings contribution, even a small amount, to strengthen your plan over time.";
      reason = "savings";
        } else {
          title = "Tip of the day";
          const tipIndex = (today.getUTCDate() + today.getUTCMonth() + plan.id.length) % DAILY_FALLBACK_TIPS.length;
          body = DAILY_FALLBACK_TIPS[tipIndex] ?? DAILY_FALLBACK_TIPS[0];
          reason = "daily_fallback";
        }
      } else if (dueSoonCount >= 1) {
        title = "Upcoming debt due dates";
    body = `You have ${dueSoonCount} payment${dueSoonCount > 1 ? "s" : ""} due within 7 days.`;
    reason = "due_soon";
      } else {
        title = "Tip of the day";
        const tipIndex = (today.getUTCDate() + today.getUTCMonth() + plan.id.length) % DAILY_FALLBACK_TIPS.length;
        body = DAILY_FALLBACK_TIPS[tipIndex] ?? DAILY_FALLBACK_TIPS[0];
        reason = "daily_fallback";
      }

    const copy = await maybeGeneratePushCopy({
      event: "budget_tip",
      context: {
        kind: dueSoonCount > 0 ? "debt" : "expense",
        budgetPlanId: plan.id,
        budgetPlanName: plan.name,
        month: currentMonth,
        year: currentYear,
        income,
        expenses,
        spendingPct: income > 0 ? Math.round((expenses / income) * 100) : null,
        dueSoonCount,
        activeDebtCount,
        totalDebtBalance,
        subscriptionCandidates: recurringChargeCandidates,
        savingsContribution,
        reason,
        goalTone: "make user feel they are in a good place",
        ...getPersonalizationContext(personalization),
      },
      fallback: { title, body },
    });

      const tipSentSummary = await sendLoggedNotifications({
        userId: plan.user.id,
        budgetPlanId: plan.id,
        type: "budget_tip",
        priority: "low",
        reason,
        metadata: {
          month: currentMonth,
          year: currentYear,
          dueSoonCount,
          activeDebtCount,
          totalDebtBalance,
          recurringChargeCandidates,
          savingsContribution,
          daysSinceLastActive: personalization.daysSinceLastActive,
          preferredSendHour: personalization.preferredSendHour,
        },
        title: copy.title,
        body: copy.body,
        webSubscriptions: [],
        mobileTokens,
        deadEndpoints,
        invalidMobileTokens,
        mobileErrors,
        mobileData: {
          type: "budget_tip",
          budgetPlanId: plan.id,
          month: currentMonth,
          year: currentYear,
        },
      });
      budgetTipMobileSent += tipSentSummary.mobileSent;
    }
  }

  const onboardingProfiles = await withPrismaRetry(() => prisma.userOnboardingProfile.findMany({
    where: {
      status: "started",
      user: {
        mobilePushTokens: { some: {} },
      },
    },
    select: {
      id: true,
      updatedAt: true,
      createdAt: true,
      mainGoal: true,
      mainGoals: true,
      occupation: true,
      occupationOther: true,
      payDay: true,
      payFrequency: true,
      billFrequency: true,
      monthlySalary: true,
      planningYears: true,
      hasAllowance: true,
      hasDebtsToManage: true,
      user: {
        select: {
          id: true,
          mobilePushTokens: {
            select: { token: true },
          },
        },
      },
    },
  }), { retries: 2, delayMs: 150 });

  const onboardingUserIds = Array.from(new Set(onboardingProfiles.map((profile) => profile.user.id)));
  const onboardingUserPrefs = await getUserNotificationPreferencesMap(onboardingUserIds);
  const onboardingPersonalization = await getUserNotificationPersonalizationMap(onboardingUserIds, today);
  let onboardingReminderMobileSent = 0;

  for (const profile of onboardingProfiles) {
    const userPrefs = onboardingUserPrefs.get(profile.user.id) ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
    if (!userPrefs.dailyTips) continue;

    const personalization = onboardingPersonalization.get(profile.user.id);
    if (!personalization || !canSendLowPriorityNotification(personalization, today, 3)) continue;

    const lastTouchedAt = profile.updatedAt ?? profile.createdAt;
    const daysInactive = Math.max(0, Math.floor((today.getTime() - lastTouchedAt.getTime()) / (24 * 60 * 60 * 1000)));
    if (daysInactive < 1) continue;

    let stage: "day_1" | "day_3" | "day_7" | null = null;
    if (daysInactive >= 7) stage = "day_7";
    else if (daysInactive >= 3) stage = "day_3";
    else stage = "day_1";

    const progressLabel = hasMeaningfulOnboardingProgress(profile)
      ? "continue_setup"
      : "start_setup";
    let title = "Finish setting up your budget";
    let body = "Pick up where you left off and get your reminders and plan working for you.";

    if (stage === "day_3") {
      title = "Your budget setup is waiting";
      body = "A quick return now can make upcoming payments easier to stay on top of.";
    } else if (stage === "day_7") {
      title = "Take the next budget step";
      body = "Finish one more setup step and let the app start working around your routine.";
    }

    const copy = await maybeGeneratePushCopy({
      event: "onboarding_reengagement",
      context: {
        kind: "onboarding",
        stage,
        progressLabel,
        daysInactive,
        mainGoal: profile.mainGoal,
        mainGoals: profile.mainGoals,
        tone: "supportive, encouraging",
        ...getPersonalizationContext(personalization),
      },
      fallback: { title, body },
    });

    const onboardingSentSummary = await sendLoggedNotifications({
      userId: profile.user.id,
      type: "onboarding_reengagement",
      priority: "low",
      reason: stage,
      metadata: {
        onboardingProfileId: profile.id,
        stage,
        daysInactive,
        progressLabel,
      },
      title: copy.title,
      body: copy.body,
      webSubscriptions: [],
      mobileTokens: profile.user.mobilePushTokens.map((token) => token.token),
      deadEndpoints,
      invalidMobileTokens,
      mobileErrors,
      mobileData: {
        type: "onboarding_reengagement",
        onboardingStage: stage,
      },
    });
    onboardingReminderMobileSent += onboardingSentSummary.mobileSent;
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
    onboardingReminderMobileSent,
    removedSubscriptions: deadEndpoints.length,
    removedMobileTokens: invalidMobileTokens.length,
    mobileErrors: uniqueMobileErrors,
  });
}

export async function GET(req: Request) {
  return handleDueReminders(req);
}

export async function POST(req: Request) {
  return handleDueReminders(req);
}
