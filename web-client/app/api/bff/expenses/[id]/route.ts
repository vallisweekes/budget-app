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
  /** Due date in ISO format (YYYY-MM-DD or full ISO datetime) */
  dueDate?: unknown;
  /** Apply updates across remaining months (mobile UI parity with Add Expense) */
  distributeMonths?: unknown;
  /** Also apply updates to next year (only when distributeMonths is true) */
  distributeYears?: unknown;
};

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
    body.categoryId == null
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
  const dueDate =
    body.dueDate == null
      ? undefined
      : typeof body.dueDate === "string"
        ? body.dueDate.trim() || null
        : null;

    const applyRemainingMonths = toBool(body.distributeMonths);
    const applyFutureYears = applyRemainingMonths ? toBool(body.distributeYears) : false;

  if (name !== undefined && !name) return badRequest("Name cannot be empty");
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
    return badRequest("Amount must be a number >= 0");
  }
  if (paidAmountExplicit !== undefined && (!Number.isFinite(paidAmountExplicit) || paidAmountExplicit < 0)) {
    return badRequest("paidAmount must be a number >= 0");
  }

  const existing = (await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
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
  } as any)) as any;
  if (!existing || existing.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextName = name ?? existing.name;
  const logo = await resolveExpenseLogoWithSearch(
    nextName,
    merchantDomain === undefined ? existing.merchantDomain : merchantDomain
  );
  const nextAmountNumber = amount ?? Number(existing.amount.toString());

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
    // Preserve payment intent: if it was fully paid, keep it fully paid after amount edits.
    const existingPaidAmountNumber = Number(existing.paidAmount.toString());
    nextPaidAmountNumber = existingPaidAmountNumber;

    if (existing.paid) {
      nextPaidAmountNumber = nextAmountNumber;
    } else {
      nextPaidAmountNumber = Math.min(existingPaidAmountNumber, nextAmountNumber);
    }

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
  const shouldSyncPayments =
    isPaymentChange ||
    nextPaid !== existing.paid ||
    Math.abs(nextPaidAmountNumber - existingPaidAmountNumber) > 1e-9;

  const updated = (await prisma.$transaction(async (tx) => {
    // Update metadata first so subsequent logic uses the latest amount/name/etc.
    await tx.expense.update({
      where: { id },
      data: ({
        name: nextName,
        amount: String(nextAmountNumber),
        categoryId: categoryId === undefined ? existing.categoryId : categoryId,
        merchantDomain: logo.merchantDomain,
        logoUrl: logo.logoUrl,
        logoSource: logo.logoSource,
        isAllocation: isAllocation === undefined ? undefined : isAllocation,
        isDirectDebit: isDirectDebit === undefined ? undefined : isDirectDebit,
        dueDate: dueDate === undefined ? undefined : dueDate,
      }) as any,
    } as any);

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
      data: ({
        paid: finalPaid,
        paidAmount: String(finalPaidAmount),
        lastPaymentAt: nextLastPaymentAt,
      }) as any,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true, featured: true },
        },
      },
    } as any)) as any;
  })) as any;

  // ── Sync expense → debt on every payment change ───────────────────────────
  // Runs whenever paid/paidAmount was explicitly provided in the request body.
  // Skips allocations and expense categories that never generate debts
  // (e.g. Savings, Income). For all other cases:
  //   • partial payment  → upsert debt with the remaining unpaid balance
  //   • fully paid       → zero out any existing debt
  //   • toggled unpaid   → zero out any existing debt (overdue processor
  //                        will recreate it when the due date passes)
  if (isPaymentChange && !updated.isAllocation && !isNonDebtCategoryName(updated.category?.name)) {
    const nextPaidAmountNumberFinal = Number(updated.paidAmount.toString());
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
    if (typeof dueDate === "string") {
      const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(dueDate);
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
        { name: existing.name, categoryId: existing.categoryId },
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
