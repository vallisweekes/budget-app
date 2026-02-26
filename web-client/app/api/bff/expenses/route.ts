import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createExpense, normalizeFundingSource, normalizePaymentSource } from "@/lib/financial-engine";

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

  return NextResponse.json((items as any[]).map(serializeExpense));
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

  return NextResponse.json(serializeExpense(created), { status: 201 });
}
