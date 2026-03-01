import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { resolveExpenseLogoWithSearch } from "@/lib/expenses/logoResolver";
import { updateExpenseAcrossMonthsByName } from "@/lib/expenses/store";
import { isNonDebtCategoryName } from "@/lib/expenses/helpers";
import { maybeSendCategoryThresholdPush } from "@/lib/push/thresholdNotifications";
import { MONTHS } from "@/lib/constants/time";
import { syncExpensePaymentsToPaidAmount } from "@/lib/expenses/paymentSync";
import type { MonthKey } from "@/types";

export const runtime = "nodejs";

const PAYMENT_EDIT_GRACE_DAYS = 5;
const PAYMENT_EDIT_GRACE_MS = PAYMENT_EDIT_GRACE_DAYS * 24 * 60 * 60 * 1000;

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

function parseDueDateInput(value: unknown): { value: Date | null | undefined; invalid: boolean } {
  // undefined = no change, null = clear
  if (value === undefined) return { value: undefined, invalid: false };
  if (value === null) return { value: null, invalid: false };

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { value: null, invalid: true } : { value, invalid: false };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { value: null, invalid: true };
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? { value: null, invalid: true } : { value: dt, invalid: false };
  }

  if (typeof value !== "string") return { value: null, invalid: true };
  const raw = value.trim();
  // Backward-compat: empty string means "clear the due date"
  if (!raw) return { value: null, invalid: false };

  // YYYY-MM-DD (date only) -> UTC midnight
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return { value: null, invalid: true };
    if (month < 1 || month > 12) return { value: null, invalid: true };
    if (day < 1 || day > 31) return { value: null, invalid: true };
    const dt = new Date(Date.UTC(y, month - 1, day));
    if (Number.isNaN(dt.getTime())) return { value: null, invalid: true };
    // Reject invalid calendar dates like 2026-02-31 (Date would otherwise roll over)
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
      return { value: null, invalid: true };
    }
    return { value: dt, invalid: false };
  }

  // Full ISO date-time string (and other JS-parseable date strings for backward compatibility)
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return { value: null, invalid: true };
  return { value: dt, invalid: false };
}

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function isWithinPaymentEditGrace(lastPaymentAt: Date | null, now = new Date()): boolean {
  if (!lastPaymentAt) return false;
  return now.getTime() - lastPaymentAt.getTime() <= PAYMENT_EDIT_GRACE_MS;
}

type SerializableExpense = {
  id: string;
  name: string;
  merchantDomain?: string | null;
  logoUrl?: string | null;
  logoSource?: string | null;
  amount: unknown;
  paid: boolean;
  paidAmount: unknown;
  isAllocation?: boolean | null;
  isDirectDebit?: boolean | null;
  month: number;
  year: number;
  categoryId?: string | null;
  category?: { name?: string | null } | null;
  dueDate?: Date | string | null;
  lastPaymentAt?: Date | string | null;
  updatedAt: Date;
  paymentSource?: string | null;
  cardDebtId?: string | null;
};

function serializeExpense(expense: SerializableExpense) {
  const paidAmountNumber = Number(expense?.paidAmount?.toString?.() ?? expense?.paidAmount ?? 0);
  const fallbackLastPaymentAt =
    !expense.lastPaymentAt && Number.isFinite(paidAmountNumber) && paidAmountNumber > 0
      ? expense.updatedAt
      : null;

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
    lastPaymentAt: (() => {
      const v = expense.lastPaymentAt ?? fallbackLastPaymentAt;
      if (!v) return null;
      return v instanceof Date ? v.toISOString() : String(v);
    })(),
    paymentSource: expense.paymentSource ?? "income",
    cardDebtId: expense.cardDebtId ?? null,
  };
}

function normalizeSeriesKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 160);
}

type PatchBody = {
  name?: unknown;
  amount?: unknown;
  categoryId?: unknown;
  merchantDomain?: unknown;
  isAllocation?: unknown;
  isDirectDebit?: unknown;
  /** Explicitly set paid status (mobile toggle) */
  paid?: unknown;
  /** Explicitly set paidAmount (mobile partial payment) */
  paidAmount?: unknown;
  /** Due date in ISO format (YYYY-MM-DD or full ISO datetime). Empty string clears it. */
  dueDate?: unknown;
  /** Apply updates across remaining months (mobile UI parity with Add Expense) */
  distributeMonths?: unknown;
  /** Also apply updates to next year (only when distributeMonths is true) */
  distributeYears?: unknown;
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      budgetPlan: { select: { userId: true } },
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
  });

  if (!expense || expense.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(serializeExpense(expense as unknown as SerializableExpense));
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");
  const body = raw as PatchBody;

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const amount = body.amount == null ? undefined : Number(body.amount);

  const categoryId =
    body.categoryId === null
      ? null
      : body.categoryId === undefined
        ? undefined
        : typeof body.categoryId === "string"
          ? body.categoryId.trim() || null
          : undefined;

  const isAllocation = body.isAllocation == null ? undefined : toBool(body.isAllocation);
  const isDirectDebit = body.isDirectDebit == null ? undefined : toBool(body.isDirectDebit);
  const merchantDomain = body.merchantDomain == null
    ? undefined
    : typeof body.merchantDomain === "string"
      ? body.merchantDomain.trim() || null
      : null;
  const paidExplicit = body.paid == null ? undefined : toBool(body.paid);
  const paidAmountExplicit = body.paidAmount == null ? undefined : Number(body.paidAmount);
  const dueDateString = typeof body.dueDate === "string" ? body.dueDate.trim() || null : null;
  const dueDateParsed = parseDueDateInput(body.dueDate);
  const dueDate = dueDateParsed.value;

  const applyRemainingMonths = toBool(body.distributeMonths);
  const applyFutureYears = applyRemainingMonths ? toBool(body.distributeYears) : false;

  if (name !== undefined && !name) return badRequest("Name cannot be empty");
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
    return badRequest("Amount must be a number >= 0");
  }
  if (paidAmountExplicit !== undefined && (!Number.isFinite(paidAmountExplicit) || paidAmountExplicit < 0)) {
    return badRequest("paidAmount must be a number >= 0");
  }
  if (body.dueDate !== undefined && dueDateParsed.invalid) {
    return badRequest("dueDate must be an ISO date (YYYY-MM-DD) or ISO datetime");
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      seriesKey: true,
      amount: true,
      paid: true,
      paidAmount: true,
      lastPaymentAt: true,
      updatedAt: true,
      isAllocation: true,
      isDirectDebit: true,
      categoryId: true,
			month: true,
			year: true,
			merchantDomain: true,
      logoUrl: true,
      logoSource: true,
			budgetPlanId: true,
      paymentSource: true,
      cardDebtId: true,
      budgetPlan: { select: { userId: true } },
    },
  });
  if (!existing || existing.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextName = name ?? existing.name;
  const nameChanged = name !== undefined && nextName !== existing.name;
  const shouldResolveLogo = nameChanged || merchantDomain !== undefined || !existing.logoUrl;

  // Stable series key: set once (if missing) and keep constant even if the display name changes.
  const existingSeriesKey = typeof existing.seriesKey === "string" && existing.seriesKey.trim() ? existing.seriesKey.trim() : null;
  const stableSeriesKey = existingSeriesKey ?? normalizeSeriesKey(existing.merchantDomain ?? existing.name);

  // If the existing merchantDomain came from inferred/search, treat it as non-authoritative
  // so the resolver can correct wrong matches when the name changes or on explicit refresh.
  const existingDomainForResolution = existing.logoSource === "manual" ? existing.merchantDomain : undefined;
  const domainForResolution = merchantDomain === undefined ? existingDomainForResolution : merchantDomain;
  const logo = shouldResolveLogo
    ? await resolveExpenseLogoWithSearch(nextName, domainForResolution)
    : {
        merchantDomain: existing.merchantDomain ?? null,
        logoUrl: existing.logoUrl ?? null,
        logoSource: existing.logoSource ?? null,
      };
  const nextAmountNumber = amount ?? Number(existing.amount.toString());

  const existingAmountNumber = Number(existing.amount.toString());
  const existingPaidAmountNumberRaw = Number(existing.paidAmount.toString());
  const existingComputedPaid =
    existingAmountNumber <= 0 ||
    existing.paid ||
    (Number.isFinite(existingPaidAmountNumberRaw) && existingPaidAmountNumberRaw >= existingAmountNumber - 0.005);
  const effectiveLastPaymentAt =
    parseDateLike(existing.lastPaymentAt) ??
    (Number.isFinite(existingPaidAmountNumberRaw) && existingPaidAmountNumberRaw > 0
      ? parseDateLike(existing.updatedAt)
      : null);

  const nextCategoryId = categoryId === undefined ? existing.categoryId : categoryId;
  const nextIsAllocation = isAllocation === undefined ? Boolean(existing.isAllocation ?? false) : isAllocation;
  const nextIsDirectDebit = isDirectDebit === undefined ? Boolean(existing.isDirectDebit ?? false) : isDirectDebit;

  // Explicit paid toggle (from mobile client) takes priority
  let nextPaidAmountNumber: number;
  let nextPaid: boolean;

  if (paidExplicit !== undefined) {
    if (paidExplicit) {
      nextPaidAmountNumber = paidAmountExplicit != null ? Math.min(paidAmountExplicit, nextAmountNumber) : nextAmountNumber;
      nextPaid = nextAmountNumber <= 0 || nextPaidAmountNumber >= nextAmountNumber;
    } else {
      nextPaidAmountNumber = 0;
      nextPaid = false;
    }
  } else if (paidAmountExplicit !== undefined) {
    nextPaidAmountNumber = Math.min(paidAmountExplicit, nextAmountNumber);
    nextPaid = nextAmountNumber > 0 && nextPaidAmountNumber >= nextAmountNumber;
  } else {
    // Metadata-only edit (name/amount/category/etc.)
    // Preserve the recorded paid amount; only clamp down if the amount is reduced.
    // This ensures increasing the amount on a previously-paid expense becomes "partial"
    // (paidAmount stays the same, remaining increases) instead of auto-generating payment.
    const existingPaidAmountNumber = Number(existing.paidAmount.toString());
    nextPaidAmountNumber = Math.min(existingPaidAmountNumber, nextAmountNumber);
    nextPaid = nextAmountNumber > 0 && nextPaidAmountNumber >= nextAmountNumber;
    if (nextPaid) nextPaidAmountNumber = nextAmountNumber;
  }

  // Determine whether to update lastPaymentAt:
  //  - unpaid toggle → clear to null
  //  - paid toggle or partial payment applied with result > 0 → stamp now
  //  - pure metadata edit (name/amount/category etc.) → leave unchanged
  let nextLastPaymentAt: Date | null | undefined;
  if (paidExplicit === false) {
    nextLastPaymentAt = null;
  } else if (
    (paidExplicit === true || paidAmountExplicit !== undefined) &&
    nextPaidAmountNumber > 0
  ) {
    nextLastPaymentAt = new Date();
  } else {
    nextLastPaymentAt = undefined; // no change
  }

  const existingPaidAmountNumber = Number(existing.paidAmount.toString());
  const isPaymentChange = paidExplicit !== undefined || paidAmountExplicit !== undefined;

  if (isPaymentChange && existingComputedPaid && !isWithinPaymentEditGrace(effectiveLastPaymentAt)) {
    return NextResponse.json(
      {
        error: `Paid payments can only be edited within ${PAYMENT_EDIT_GRACE_DAYS} days of the last payment.`,
      },
      { status: 403 }
    );
  }

  const shouldSyncPayments =
    isPaymentChange ||
    nextPaid !== existing.paid ||
    Math.abs(nextPaidAmountNumber - existingPaidAmountNumber) > 1e-9;

  const updated = await prisma.$transaction(async (tx) => {
    if (nameChanged) {
      await tx.expenseNameChange.create({
        data: { expenseId: id, fromName: existing.name, toName: nextName },
      });
    }

    // Update metadata first so subsequent logic uses the latest amount/name/etc.
    await tx.expense.update({
      where: { id },
      data: {
        name: nextName,
        seriesKey: existingSeriesKey ? undefined : stableSeriesKey,
        amount: String(nextAmountNumber),
        categoryId: categoryId === undefined ? undefined : categoryId,
        merchantDomain: logo.merchantDomain,
        logoUrl: logo.logoUrl,
        logoSource: logo.logoSource,
        isAllocation: isAllocation === undefined ? undefined : isAllocation,
        isDirectDebit: isDirectDebit === undefined ? undefined : isDirectDebit,

        dueDate: dueDate === undefined ? undefined : dueDate,
      },
    });

    const sync = shouldSyncPayments
      ? await syncExpensePaymentsToPaidAmount({
          tx,
          expenseId: id,
          budgetPlanId: existing.budgetPlanId,
          amount: nextAmountNumber,
          desiredPaidAmount: nextPaidAmountNumber,
          paymentSource: existing.paymentSource ?? "income",
          cardDebtId: existing.cardDebtId ?? null,
          now: nextLastPaymentAt ?? undefined,
          adjustBalances: isPaymentChange,
          resetOnDecrease: true,
        })
      : null;

    const finalPaidAmount = sync ? sync.finalPaidAmount : nextPaidAmountNumber;
    const finalPaid = sync ? sync.finalPaid : nextPaid;

    return (await tx.expense.update({
      where: { id },
      data: {
        paid: finalPaid,
        paidAmount: String(finalPaidAmount),
        lastPaymentAt: nextLastPaymentAt,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, featured: true },
        },
      },
    })) as unknown as SerializableExpense;
  });

  // ── Sync expense → debt on every payment change ───────────────────────────
  // Runs whenever paid/paidAmount was explicitly provided in the request body.
  // Skips allocations and expense categories that never generate debts
  // (e.g. Savings, Income). For all other cases:
  //   • partial payment  → upsert debt with the remaining unpaid balance
  //   • fully paid       → zero out any existing debt
  //   • toggled unpaid   → zero out any existing debt (overdue processor
  //                        will recreate it when the due date passes)
  if (isPaymentChange && !updated.isAllocation && !isNonDebtCategoryName(updated.category?.name)) {
    const nextPaidAmountNumberFinal = Number(decimalToString(updated.paidAmount));
    const isPartial = !updated.paid && nextPaidAmountNumberFinal > 0;
    const debtRemainingAmount = isPartial
      ? Math.max(0, nextAmountNumber - nextPaidAmountNumberFinal)
      : 0;
    await upsertExpenseDebt({
      budgetPlanId: existing.budgetPlanId,
      expenseId: existing.id,
      monthKey: monthNumberToKey(existing.month),
      year: existing.year,
      categoryId: updated.categoryId ?? undefined,
      categoryName: updated.category?.name ?? undefined,
      expenseName: updated.name,
      remainingAmount: debtRemainingAmount,
    });
  }

  // If the expense amount changes (but paid/paidAmount did not), keep any existing
  // linked expense-backed debt in sync with the new remaining balance.
  // Important: we do NOT create new debts here (overdue processor controls that).
  const isAmountChange = amount !== undefined;
  if (!isPaymentChange && isAmountChange && !updated.isAllocation && !isNonDebtCategoryName(updated.category?.name)) {
    const existingDebt = await prisma.debt.findFirst({
      where: {
        budgetPlanId: existing.budgetPlanId,
        sourceType: "expense",
        sourceExpenseId: existing.id,
      },
      select: { sourceMonthKey: true },
    });

    if (existingDebt) {
      const nextPaidAmountNumberFinal = Number(decimalToString(updated.paidAmount));
      const debtRemainingAmount = updated.paid ? 0 : Math.max(0, nextAmountNumber - nextPaidAmountNumberFinal);
      await upsertExpenseDebt({
        budgetPlanId: existing.budgetPlanId,
        expenseId: existing.id,
        monthKey: existingDebt.sourceMonthKey ?? monthNumberToKey(existing.month),
        year: existing.year,
        categoryId: updated.categoryId ?? undefined,
        categoryName: updated.category?.name ?? undefined,
        expenseName: updated.name,
        remainingAmount: debtRemainingAmount,
      });
    }
  }

  if (applyRemainingMonths) {
    const monthIndex0 = Math.min(11, Math.max(0, Number(existing.month) - 1));
    const monthsThisYear = (MONTHS as MonthKey[]).slice(monthIndex0);
    const years = applyFutureYears ? [existing.year, existing.year + 1] : [existing.year];

    // If a due date is provided, propagate it across months as:
    // - same day-of-month
    // - same relative month offset from the expense month
    // Example: editing JAN expense due 2026-02-24 => FEB expense due 2026-03-24.
    let dueDateDay: number | undefined;
    let dueDateMonthOffset: number | undefined;
    if (dueDateString) {
      const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(dueDateString);
      if (m) {
        const dueYear = Number(m[1]);
        const dueMonth = Number(m[2]);
        const day = Number(m[3]);
        if (
          Number.isFinite(dueYear) &&
          Number.isFinite(dueMonth) &&
          dueMonth >= 1 &&
          dueMonth <= 12 &&
          Number.isFinite(day)
        ) {
          dueDateDay = day;
          dueDateMonthOffset = (dueYear - existing.year) * 12 + (dueMonth - existing.month);
        }
      }
    }

    const touched: Array<{ id: string; monthNumber: number }> = [];
    for (const y of years) {
      const monthsForYear = y === existing.year ? monthsThisYear : (MONTHS as MonthKey[]);
      const rows = await updateExpenseAcrossMonthsByName(
        existing.budgetPlanId,
        { name: existing.name, categoryId: existing.categoryId, seriesKey: stableSeriesKey },
        {
          name: nextName,
          amount: nextAmountNumber,
          categoryId: nextCategoryId,
          isAllocation: nextIsAllocation,
          isDirectDebit: nextIsDirectDebit,
          dueDateDay,
          dueDateMonthOffset,
          merchantDomain: logo.merchantDomain,
        },
        y,
        monthsForYear
      );
      touched.push(...rows);
    }

    // If this is now an allocation, ensure any existing expense-backed debts are zeroed.
    if (nextIsAllocation && touched.length) {
      for (const row of touched) {
        const existingDebt = await prisma.debt.findFirst({
          where: {
            budgetPlanId: existing.budgetPlanId,
            sourceType: "expense",
            sourceExpenseId: row.id,
          },
          select: { sourceMonthKey: true },
        });

        if (!existingDebt) continue;
        const monthKey = existingDebt.sourceMonthKey ?? monthNumberToKey(row.monthNumber);
        await upsertExpenseDebt({
          budgetPlanId: existing.budgetPlanId,
          expenseId: row.id,
          monthKey,
          expenseName: nextName,
          categoryId: nextCategoryId ?? undefined,
          categoryName: updated.category?.name ?? undefined,
          remainingAmount: 0,
        });
      }
    }
  }

  if (updated.isAllocation) {
    const existingDebt = await prisma.debt.findFirst({
      where: {
        budgetPlanId: existing.budgetPlanId,
        sourceType: "expense",
        sourceExpenseId: existing.id,
      },
      select: { sourceMonthKey: true },
    });

    if (existingDebt) {
      const monthKey = existingDebt.sourceMonthKey ?? monthNumberToKey(updated.month);
      await upsertExpenseDebt({
        budgetPlanId: existing.budgetPlanId,
        expenseId: existing.id,
        monthKey,
        expenseName: updated.name,
        categoryId: updated.categoryId ?? undefined,
        categoryName: updated.category?.name ?? undefined,
        remainingAmount: 0,
      });
    }
  }

  // Fire category threshold push in background — only when amount or category changed
  if (!updated.isAllocation && nextCategoryId) {
    const categoryChanged = categoryId !== undefined && categoryId !== existing.categoryId;
    const amountChanged = amount !== undefined;
    if (categoryChanged || amountChanged) {
      const existingAmountNumber = Number(existing.amount.toString());
      const amountDelta = categoryChanged
        ? nextAmountNumber                             // full amount moves to new category
        : nextAmountNumber - existingAmountNumber;    // net change within same category
      void maybeSendCategoryThresholdPush({
        budgetPlanId: existing.budgetPlanId,
        categoryId: nextCategoryId,
        categoryName: updated.category?.name ?? null,
        month: existing.month,
        year: existing.year,
        userId,
        amountDelta,
      });
    }
  }

  return NextResponse.json(serializeExpense(updated));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

	const existing = await prisma.expense.findUnique({
		where: { id },
		select: { id: true, budgetPlan: { select: { userId: true } } },
	});
	if (!existing || existing.budgetPlan.userId !== userId) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

  await prisma.expense.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true as const });
}
