import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportsExpenseMovedToDebtField, supportsOnboardingPayFrequencyField } from "@/lib/prisma/capabilities";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { createExpense, normalizeFundingSource, normalizePaymentSource } from "@/lib/financial-engine";
import { hasCustomLogoForDomain, hasCustomLogoForName, resolveExpenseLogo, resolveExpenseLogoWithSearch } from "@/lib/expenses/logoResolver";
import { buildExpenseAddedActivity } from "@/lib/push/activityMessages";
import { sendUserPush } from "@/lib/push/sendUserPush";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";
import { getExpensePaidMap } from "@/lib/expenses/paidSummary";
import {
  buildPayPeriodFromMonthAnchor,
  normalizePayFrequency,
  type PayFrequency,
} from "@/lib/payPeriods";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (!v) return false;
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  }
  return false;
}

function decimalToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof (value as { toString: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "0";
}

function isUnknownMovedToDebtFieldError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error);
  return (
    message.includes("isMovedToDebt") &&
    (message.includes("Unknown arg") ||
      message.includes("Unknown argument") ||
      message.includes("Unknown field"))
  );
}

function isUnknownPayFrequencyFieldError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error);
  return (
    message.includes("payFrequency") &&
    (message.includes("Unknown arg") ||
      message.includes("Unknown argument") ||
      message.includes("Unknown field"))
  );
}

async function findOnboardingPayFrequency(userId: string) {
  if (!(await supportsOnboardingPayFrequencyField())) return null;

  try {
    const profile = await prisma.userOnboardingProfile.findUnique({ where: { userId }, select: { payFrequency: true } });
    return profile;
  } catch (error) {
    if (!isUnknownPayFrequencyFieldError(error)) throw error;
    return null;
  }
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function isPastUtcDateOnly(date: Date): boolean {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return target.getTime() < today.getTime();
}

function inRange(target: Date, start: Date, end: Date): boolean {
  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

async function bestEffortWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), ms);
      }),
    ]);
    return result as T | null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function toFloat(value: unknown): number {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value ?? "0"));
  return isNaN(n) ? 0 : n;
}

function serializeExpense(
  expense: any,
  latestPaidAt: Date | null,
  periodMeta?: { effectiveDueDate: string | null; inSelectedPayPeriod: boolean },
  paidOverride?: { paid: boolean; paidAmount: number },
) {
  const paidAmountNumber = paidOverride
    ? paidOverride.paidAmount
    : Number(expense?.paidAmount?.toString?.() ?? expense?.paidAmount ?? 0);
  const effectiveLastPaymentAt =
    latestPaidAt ??
    (expense.lastPaymentAt instanceof Date
      ? expense.lastPaymentAt
      : Number.isFinite(paidAmountNumber) && paidAmountNumber > 0 && expense.updatedAt instanceof Date
        ? expense.updatedAt
        : null);

  return {
    id: expense.id,
    name: expense.name,
    merchantDomain: expense.merchantDomain ?? null,
    logoUrl: expense.logoUrl ?? null,
    logoSource: expense.logoSource ?? null,
    amount: decimalToString(expense.amount),
    paid: paidOverride ? paidOverride.paid : expense.paid,
    paidAmount: paidOverride ? decimalToString(paidOverride.paidAmount) : decimalToString(expense.paidAmount),
    isAllocation: Boolean(expense.isAllocation ?? false),
    isDirectDebit: Boolean(expense.isDirectDebit ?? false),
    month: expense.month,
    year: expense.year,
    categoryId: expense.categoryId,
    category: expense.category ?? null,
    dueDate: expense.dueDate ? (expense.dueDate instanceof Date ? expense.dueDate.toISOString() : String(expense.dueDate)) : null,
    lastPaymentAt: effectiveLastPaymentAt ? effectiveLastPaymentAt.toISOString() : null,
    paymentSource: expense.paymentSource ?? "income",
    cardDebtId: expense.cardDebtId ?? null,
    isExtraLoggedExpense: Boolean((expense as { isExtraLoggedExpense?: unknown }).isExtraLoggedExpense ?? false),
    effectiveDueDate: periodMeta?.effectiveDueDate ?? null,
    inSelectedPayPeriod: periodMeta?.inSelectedPayPeriod ?? false,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = toNumber(searchParams.get("month"));
  const year = toNumber(searchParams.get("year"));
  const scope = String(searchParams.get("scope") ?? "month").toLowerCase() === "pay_period" ? "pay_period" : "month";
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const refreshLogos = toBool(searchParams.get("refreshLogos"));

  const budgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: searchParams.get("budgetPlanId"),
	});

  if (month == null || month < 1 || month > 12) return badRequest("Invalid month");
  if (year == null || year < 1900) return badRequest("Invalid year");
  if (!budgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });

  const [budgetPlan, onboardingProfile] = await Promise.all([
    prisma.budgetPlan.findUnique({ where: { id: budgetPlanId }, select: { payDate: true } }),
    findOnboardingPayFrequency(userId),
  ]);
  const payDate = Number.isFinite(Number(budgetPlan?.payDate)) && Number(budgetPlan?.payDate) >= 1
    ? Math.floor(Number(budgetPlan?.payDate))
    : 1;
  const payFrequency: PayFrequency = normalizePayFrequency(onboardingProfile?.payFrequency);

  const selectedPeriod = buildPayPeriodFromMonthAnchor({
    anchorYear: year,
    anchorMonth: month,
    payDate,
    payFrequency,
  });
  const allowedUnscheduledYm = new Set([
    `${selectedPeriod.start.getUTCFullYear()}-${selectedPeriod.start.getUTCMonth() + 1}`,
    `${selectedPeriod.end.getUTCFullYear()}-${selectedPeriod.end.getUTCMonth() + 1}`,
  ]);

  const items = await (async () => {
    const periodPairs = [
      { year: selectedPeriod.start.getUTCFullYear(), month: selectedPeriod.start.getUTCMonth() + 1 },
      { year: selectedPeriod.end.getUTCFullYear(), month: selectedPeriod.end.getUTCMonth() + 1 },
      {
        year: new Date(Date.UTC(selectedPeriod.start.getUTCFullYear(), selectedPeriod.start.getUTCMonth() - 1, 1)).getUTCFullYear(),
        month: new Date(Date.UTC(selectedPeriod.start.getUTCFullYear(), selectedPeriod.start.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
      },
      {
        year: new Date(Date.UTC(selectedPeriod.end.getUTCFullYear(), selectedPeriod.end.getUTCMonth() + 1, 1)).getUTCFullYear(),
        month: new Date(Date.UTC(selectedPeriod.end.getUTCFullYear(), selectedPeriod.end.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
      },
    ];
    const uniquePeriodPairs = Array.from(new Map(periodPairs.map((p) => [`${p.year}-${p.month}`, p])).values());

    const runLegacyQuery = () =>
      prisma.expense.findMany({
        where: scope === "pay_period"
          ? { budgetPlanId, OR: uniquePeriodPairs }
          : { budgetPlanId, month, year },
        orderBy: [{ createdAt: "asc" }],
        include: {
          category: {
            select: { id: true, name: true, icon: true, color: true, featured: true },
          },
        },
      });

    if (!(await supportsExpenseMovedToDebtField())) {
      return runLegacyQuery();
    }

    try {
      const rows = await prisma.expense.findMany({
        where: scope === "pay_period"
          ? { budgetPlanId, OR: uniquePeriodPairs, isMovedToDebt: false }
          : { budgetPlanId, month, year, isMovedToDebt: false },
        orderBy: [{ createdAt: "asc" }],
        include: {
          category: {
            select: { id: true, name: true, icon: true, color: true, featured: true },
          },
        },
        // dueDate is a scalar on Expense, included automatically
      });
      return rows;
    } catch (error) {
      if (!isUnknownMovedToDebtFieldError(error)) throw error;
      return runLegacyQuery();
    }
  })();

  const ids = (items as any[]).map((e) => e.id).filter(Boolean);
  const latestPayments = ids.length
    ? await prisma.expensePayment.groupBy({
        by: ["expenseId"],
        where: { expenseId: { in: ids } },
        _max: { paidAt: true },
      })
    : [];
  const latestPaidAtByExpenseId = new Map(
    latestPayments.map((row) => [row.expenseId, row._max.paidAt ?? null] as const)
  );

  // Canonical paid status/amounts from the expensePayment transaction table.
  // This keeps /api/bff/expenses consistent with /api/bff/expenses/summary.
  const paidCandidates = (items as any[])
    .filter((item) => !(scope === "pay_period" && isLegacyPlaceholderExpenseRow(item)))
    .filter((item) => !Boolean(item?.isAllocation ?? false));
  const paidMap = await getExpensePaidMap(
    paidCandidates.map((e) => ({ id: String(e.id), amount: toFloat(e.amount) })),
  );

  // Backfill/refresh logos.
  // - Backfill runs when logoUrl is missing.
  // - Refresh (opt-in) re-resolves non-manual logos to correct bad matches.
  // Keep this bounded to avoid long response times.
  const MAX_ENRICH = 8;
  const MAX_REFRESH = 8;
  let enrichedCount = 0;
  let refreshedCount = 0;

  const out: any[] = [];
  const seenPayPeriod = new Map<string, { rank: number }>();
  for (const item of items as any[]) {
    if (scope === "pay_period" && isLegacyPlaceholderExpenseRow(item)) {
      continue;
    }

    // Allocations/envelopes are not bills and should not appear in Expenses lists.
    if (Boolean(item.isAllocation ?? false)) {
      continue;
    }
    const isManual = item.logoSource === "manual";
    const hasCustomDomainOverride = hasCustomLogoForDomain(item.merchantDomain ?? null);
    const inferredFromName = resolveExpenseLogo(item.name, undefined);
    const hasCustomNameOverride = hasCustomLogoForName(item.name);
    const desiredCustomLogoUrl =
      (hasCustomDomainOverride && resolveExpenseLogo(item.name, item.merchantDomain ?? undefined).logoUrl) ||
      (hasCustomNameOverride && inferredFromName.logoUrl) ||
      null;
    const needsBackfill = !item.logoUrl;
    const shouldAutoCustomRefresh =
      Boolean(desiredCustomLogoUrl) &&
      item.logoUrl !== desiredCustomLogoUrl &&
      (hasCustomDomainOverride || !isManual);
    const shouldForceCustomRefresh = refreshLogos && (hasCustomDomainOverride || hasCustomNameOverride);
    const shouldRefresh = refreshLogos && (!isManual || hasCustomDomainOverride || hasCustomNameOverride);

    const shouldResolve =
      shouldAutoCustomRefresh ||
      shouldForceCustomRefresh ||
      (needsBackfill && enrichedCount < MAX_ENRICH) ||
      (shouldRefresh && refreshedCount < MAX_REFRESH);
    if (shouldResolve) {
      if (needsBackfill) enrichedCount += 1;
      else if (!shouldForceCustomRefresh) refreshedCount += 1;

      // If we can infer a custom logo from the name, do not preserve stale manual domains.
      const preserveManualDomain = isManual && !hasCustomDomainOverride && !hasCustomNameOverride;

      const resolved = await resolveExpenseLogoWithSearch(
        item.name,
        // If the user explicitly set a domain, keep it stable.
        preserveManualDomain ? item.merchantDomain : undefined
      );

      const changed =
        resolved.merchantDomain !== (item.merchantDomain ?? null) ||
        resolved.logoUrl !== (item.logoUrl ?? null) ||
        resolved.logoSource !== (item.logoSource ?? null);

      if (changed && (resolved.merchantDomain || resolved.logoUrl || resolved.logoSource)) {
        // Persist best-effort so future loads are instant.
        await prisma.expense
          .update({
            where: { id: item.id },
            data: {
              merchantDomain: resolved.merchantDomain,
              logoUrl: resolved.logoUrl,
              logoSource: resolved.logoSource,
            },
          })
          .catch(() => null);

        item.merchantDomain = resolved.merchantDomain;
        item.logoUrl = resolved.logoUrl;
        item.logoSource = resolved.logoSource;
      }
    }

    const canonicalPaidInfo = paidMap.get(String(item.id));
    const canonicalPaidAmountRaw = canonicalPaidInfo?.paidAmount ?? toFloat(item.paidAmount);
    const canonicalIsPaid = canonicalPaidInfo?.isPaid ?? Boolean(item.paid);
    const amountNumber = toFloat(item.amount);
    const canonicalPaidAmount = amountNumber > 0 ? Math.min(canonicalPaidAmountRaw, amountNumber) : 0;

    const dueIso = item.dueDate
      ? resolveEffectiveDueDateIso(
          {
            id: item.id,
            name: item.name,
            amount: Number(item.amount?.toString?.() ?? item.amount ?? 0),
            paid: canonicalIsPaid,
            paidAmount: canonicalPaidAmount,
            dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : undefined,
          },
          { year: item.year, monthNum: item.month, payDate }
        )
      : null;
    const dueDateOnly = dueIso ? parseIsoDate(dueIso) : null;
    const inSelectedPayPeriod =
      scope === "pay_period"
        ? dueDateOnly
          ? inRange(dueDateOnly, selectedPeriod.start, selectedPeriod.end)
          : item.periodKey
            ? item.periodKey === selectedPeriod.start.toISOString().slice(0, 10)
            : allowedUnscheduledYm.has(`${item.year}-${item.month}`)
        : true;

    if (scope === "pay_period" && !inSelectedPayPeriod) {
      continue;
    }

    // Prevent duplicates in pay-period scope when the same recurring bill exists
    // across multiple month rows (e.g. distributed across months with a fixed dueDate).
    if (scope === "pay_period" && dueIso) {
      const series = String(item.seriesKey ?? item.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      const amount = Number(item.amount?.toString?.() ?? item.amount ?? 0);
      const key = `${series}|${dueIso}|${amount}`;
      const ym = /^\d{4}-\d{2}-\d{2}$/.test(dueIso)
        ? { year: Number(dueIso.slice(0, 4)), month: Number(dueIso.slice(5, 7)) }
        : null;
      const rank = ym && Number.isFinite(ym.year) && Number.isFinite(ym.month) && item.year === ym.year && item.month === ym.month ? 0 : 1;
      const existing = seenPayPeriod.get(key);
      if (existing) {
        // Prefer the row whose stored month/year matches the due month/year.
        if (!(rank < existing.rank)) {
          continue;
        }
      }
      seenPayPeriod.set(key, { rank });
    }

    const latestPaidAt = latestPaidAtByExpenseId.get(item.id) ?? null;
    out.push(serializeExpense(item, latestPaidAt, {
      effectiveDueDate: dueIso,
      inSelectedPayPeriod,
    }, {
      paid: canonicalIsPaid,
      paidAmount: canonicalPaidAmount,
    }));
  }

  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");

  const body = raw as {
    budgetPlanId?: unknown;
    name?: unknown;
    seriesKey?: unknown;
    amount?: unknown;
    month?: unknown;
    year?: unknown;
    periodKey?: unknown;
    categoryId?: unknown;
    paid?: unknown;
    isAllocation?: unknown;
    isDirectDebit?: unknown;
    isExtraLoggedExpense?: unknown;
    distributeMonths?: unknown;
    distributeYears?: unknown;
    dueDate?: unknown;
    paymentSource?: unknown;
    cardDebtId?: unknown;
    fundingSource?: unknown;
    debtId?: unknown;
    newLoanName?: unknown;
  };

  const ownedBudgetPlanId = await resolveOwnedBudgetPlanId({
		userId,
		budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
	});

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const seriesKey = typeof body.seriesKey === "string" ? body.seriesKey.trim() : "";
  const amount = Number(body.amount);
  const inputMonth = Number(body.month);
  const inputYear = Number(body.year);
  const periodKey = typeof body.periodKey === "string" ? body.periodKey.trim() : "";
  const periodDate = /^\d{4}-\d{2}-\d{2}$/.test(periodKey) ? parseIsoDate(periodKey) : null;
  const month = Number.isFinite(inputMonth) ? inputMonth : (periodDate ? periodDate.getUTCMonth() + 1 : Number.NaN);
  const year = Number.isFinite(inputYear) ? inputYear : (periodDate ? periodDate.getUTCFullYear() : Number.NaN);
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : undefined;
  const paid = toBool(body.paid);
  const isAllocation = toBool(body.isAllocation);
  const isDirectDebit = toBool(body.isDirectDebit);
  const isExtraLoggedExpense = toBool(body.isExtraLoggedExpense);
  const distributeMonths = toBool(body.distributeMonths);
  const distributeYears = toBool(body.distributeYears);
  // Accept YYYY-MM-DD only; silently drop malformed values
  const dueDate =
    typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim())
      ? body.dueDate.trim()
      : undefined;

  const paymentSource = normalizePaymentSource(body.paymentSource);
  const fundingSource = normalizeFundingSource(body.fundingSource ?? body.paymentSource);
  const cardDebtId = typeof body.cardDebtId === "string" ? body.cardDebtId.trim() : undefined;
  const debtId = typeof body.debtId === "string" ? body.debtId.trim() : undefined;
  const newLoanName = typeof body.newLoanName === "string" ? body.newLoanName.trim() : undefined;

  if (!ownedBudgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
  if (!name) return badRequest("Name is required");
  if (seriesKey && seriesKey.length > 160) return badRequest("seriesKey is too long");
  if (!Number.isFinite(amount) || amount < 0) return badRequest("Amount must be a number >= 0");
  if (periodKey && !periodDate) return badRequest("Invalid periodKey");
  if (!Number.isFinite(month) || month < 1 || month > 12) return badRequest("Invalid month");
  if (!Number.isFinite(year) || year < 1900) return badRequest("Invalid year");
  if (dueDate) {
    const parsedDueDate = parseIsoDate(dueDate);
    if (!parsedDueDate) return badRequest("Invalid dueDate");
    if (isPastUtcDateOnly(parsedDueDate)) return badRequest("dueDate cannot be in the past");
  }

  const createdResult = await createExpense({
    budgetPlanId: ownedBudgetPlanId,
    userId,
    name,
    seriesKey: seriesKey || undefined,
    amount,
    month,
    year,
    categoryId,
    paid,
    isAllocation,
    isDirectDebit,
    isExtraLoggedExpense,
    distributeMonths,
    distributeYears,
    dueDate,
    paymentSource,
    fundingSource,
    cardDebtId: cardDebtId || undefined,
    debtId: debtId || undefined,
    newLoanName: newLoanName || undefined,
    periodKey: periodDate ? periodDate.toISOString().slice(0, 10) : undefined,
  });

  const created = await prisma.expense.findFirst({
    where: { id: createdResult.expenseId },
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!created) return NextResponse.json({ error: "Expense was not created" }, { status: 500 });

  // NOTE: Mobile UX depends on this endpoint returning quickly.
  // We bound any enrichment / push work so it can't hang the Add sheet.

  // Ensure logos appear quickly when possible, but never block the response for long.
  // If the enrichment takes too long, we return immediately and it can be refreshed later.
  const maybeEnriched = !created.logoUrl
    ? await bestEffortWithin(
        (async () => {
          const resolved = await resolveExpenseLogoWithSearch(created.name, created.merchantDomain);
          if (!(resolved.merchantDomain || resolved.logoUrl || resolved.logoSource)) return created;
          const updated = await prisma.expense.update({
            where: { id: created.id },
            data: {
              merchantDomain: resolved.merchantDomain,
              logoUrl: resolved.logoUrl,
              logoSource: resolved.logoSource,
            },
            include: {
              category: {
                select: { id: true, name: true, icon: true, color: true, featured: true },
              },
            },
          });
          return updated;
        })().catch(() => created),
        900,
      )
    : created;

  const finalCreated: any = maybeEnriched ?? created;

  // Push notifications are best-effort and should not delay the response.
  void bestEffortWithin(
    (async () => {
      const plan = await prisma.budgetPlan.findUnique({
        where: { id: ownedBudgetPlanId },
        select: { currency: true },
      });
      const planCurrency = plan?.currency ?? "GBP";
      const msg = await buildExpenseAddedActivity({
        name: finalCreated.name,
        amount,
        currency: planCurrency,
        url: "/dashboard",
      });
      await sendUserPush({ userId, preference: "paymentAlerts", web: msg.web, mobile: msg.mobile });
    })().catch(() => null),
    900,
  );

  await invalidateDashboardCache(ownedBudgetPlanId);

  return NextResponse.json(serializeExpense(finalCreated, null), { status: 201 });
}
