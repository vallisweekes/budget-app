import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { upsertExpenseDebt } from "@/lib/debts/store";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { resolveExpenseLogo } from "@/lib/expenses/logoResolver";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
    month: expense.month,
    year: expense.year,
    categoryId: expense.categoryId,
    category: expense.category ?? null,
    dueDate: expense.dueDate ? (expense.dueDate instanceof Date ? expense.dueDate.toISOString() : String(expense.dueDate)) : null,
  };
}

type PatchBody = {
  name?: unknown;
  amount?: unknown;
  categoryId?: unknown;
  merchantDomain?: unknown;
  isAllocation?: unknown;
  /** Explicitly set paid status (mobile toggle) */
  paid?: unknown;
  /** Explicitly set paidAmount (mobile partial payment) */
  paidAmount?: unknown;
  /** Due date in ISO format (YYYY-MM-DD or full ISO datetime) */
  dueDate?: unknown;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
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
	const isAllocation = body.isAllocation == null ? undefined : Boolean(body.isAllocation);
  const merchantDomain = body.merchantDomain == null
    ? undefined
    : typeof body.merchantDomain === "string"
      ? body.merchantDomain.trim() || null
      : null;
  const paidExplicit = body.paid == null ? undefined : Boolean(body.paid);
  const paidAmountExplicit = body.paidAmount == null ? undefined : Number(body.paidAmount);
  const dueDate =
    body.dueDate == null
      ? undefined
      : typeof body.dueDate === "string"
        ? body.dueDate.trim() || null
        : null;

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
      categoryId: true,
			merchantDomain: true,
      logoUrl: true,
      logoSource: true,
			budgetPlanId: true,
      budgetPlan: { select: { userId: true } },
    },
  } as any)) as any;
  if (!existing || existing.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextName = name ?? existing.name;
  const logo = resolveExpenseLogo(nextName, merchantDomain === undefined ? existing.merchantDomain : merchantDomain);
  const nextAmountNumber = amount ?? Number(existing.amount.toString());

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

  const updated = (await prisma.expense.update({
    where: { id },
    data: ({
      name: nextName,
      amount: String(nextAmountNumber),
      paid: nextPaid,
      paidAmount: String(nextPaidAmountNumber),
      categoryId: categoryId === undefined ? existing.categoryId : categoryId,
      merchantDomain: logo.merchantDomain,
      logoUrl: logo.logoUrl,
      logoSource: logo.logoSource,
      isAllocation: isAllocation === undefined ? undefined : isAllocation,
      dueDate: dueDate === undefined ? undefined : dueDate,
    }) as any,
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
  } as any)) as any;

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

  return NextResponse.json(serializeExpense(updated));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
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
