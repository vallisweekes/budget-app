import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createExpense, normalizeFundingSource, normalizePaymentSource } from "@/lib/financial-engine";
import { hasCustomLogoForDomain, hasCustomLogoForName, resolveExpenseLogo, resolveExpenseLogoWithSearch } from "@/lib/expenses/logoResolver";

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

function serializeExpense(expense: any) {
  return {
    id: expense.id,
    name: expense.name,
    merchantDomain: expense.merchantDomain ?? null,
    logoUrl: expense.logoUrl ?? null,
    logoSource: expense.logoSource ?? null,
    amount: decimalToString(expense.amount),
    paid: expense.paid,
    paidAmount: decimalToString(expense.paidAmount),
    isAllocation: Boolean(expense.isAllocation ?? false),
    isDirectDebit: Boolean(expense.isDirectDebit ?? false),
    month: expense.month,
    year: expense.year,
    categoryId: expense.categoryId,
    category: expense.category ?? null,
    dueDate: expense.dueDate ? (expense.dueDate instanceof Date ? expense.dueDate.toISOString() : String(expense.dueDate)) : null,
    lastPaymentAt: expense.lastPaymentAt ? (expense.lastPaymentAt instanceof Date ? expense.lastPaymentAt.toISOString() : String(expense.lastPaymentAt)) : null,
    paymentSource: expense.paymentSource ?? "income",
    cardDebtId: expense.cardDebtId ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = toNumber(searchParams.get("month"));
  const year = toNumber(searchParams.get("year"));
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

  const items = await prisma.expense.findMany({
    where: { budgetPlanId, month, year },
    orderBy: [{ createdAt: "asc" }],
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
    // dueDate is a scalar on Expense, included automatically
  });

  // Backfill/refresh logos.
  // - Backfill runs when logoUrl is missing.
  // - Refresh (opt-in) re-resolves non-manual logos to correct bad matches.
  // Keep this bounded to avoid long response times.
  const MAX_ENRICH = 8;
  const MAX_REFRESH = 8;
  let enrichedCount = 0;
  let refreshedCount = 0;

  const out: any[] = [];
  for (const item of items as any[]) {
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

    out.push(serializeExpense(item));
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
    amount?: unknown;
    month?: unknown;
    year?: unknown;
    categoryId?: unknown;
    paid?: unknown;
    isAllocation?: unknown;
    isDirectDebit?: unknown;
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
  const amount = Number(body.amount);
  const month = Number(body.month);
  const year = Number(body.year);
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : undefined;
  const paid = toBool(body.paid);
  const isAllocation = toBool(body.isAllocation);
  const isDirectDebit = toBool(body.isDirectDebit);
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
  if (!Number.isFinite(amount) || amount < 0) return badRequest("Amount must be a number >= 0");
  if (!Number.isFinite(month) || month < 1 || month > 12) return badRequest("Invalid month");
  if (!Number.isFinite(year) || year < 1900) return badRequest("Invalid year");

  const createdResult = await createExpense({
    budgetPlanId: ownedBudgetPlanId,
    userId,
    name,
    amount,
    month,
    year,
    categoryId,
    paid,
    isAllocation,
    isDirectDebit,
    distributeMonths,
    distributeYears,
    dueDate,
    paymentSource,
    fundingSource,
    cardDebtId: cardDebtId || undefined,
    debtId: debtId || undefined,
    newLoanName: newLoanName || undefined,
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

  // Ensure logos appear immediately after creation (not only after a later edit).
  // This is especially important for rows that were created before logo enrichment
  // was fully wired up, or when the resolver can determine a domain from the name.
  let finalCreated: any = created;
  if (!finalCreated.logoUrl) {
    const resolved = await resolveExpenseLogoWithSearch(finalCreated.name, finalCreated.merchantDomain);
    if (resolved.merchantDomain || resolved.logoUrl || resolved.logoSource) {
      finalCreated = await prisma.expense
        .update({
          where: { id: finalCreated.id },
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
        })
        .catch(() => finalCreated);
    }
  }

  return NextResponse.json(serializeExpense(finalCreated), { status: 201 });
}
