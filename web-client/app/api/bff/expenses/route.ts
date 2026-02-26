import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { addOrUpdateExpenseAcrossMonths } from "@/lib/expenses/store";
import { resolveExpenseLogoWithSearch } from "@/lib/expenses/logoResolver";
import { maybeSendCategoryThresholdPush } from "@/lib/push/thresholdNotifications";
import { MONTHS } from "@/lib/constants/time";
import { getSettings, saveSettings } from "@/lib/settings/store";
import type { MonthKey } from "@/types";

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
  const userId = await getSessionUserId();
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
  const userId = await getSessionUserId();
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

  // Payment source — normalise to valid enum values
  type PaymentSource = "income" | "credit_card" | "savings" | "extra_untracked";
  function normalizeSource(raw: unknown): PaymentSource {
    const v = String(raw ?? "").trim().toLowerCase();
    if (v === "credit_card" || v === "card" || v === "credit card") return "credit_card";
    if (v === "savings") return "savings";
    if (v === "other" || v === "extra_untracked") return "extra_untracked";
    return "income";
  }
  const paymentSource = normalizeSource(body.paymentSource);
  const cardDebtId = typeof body.cardDebtId === "string" ? body.cardDebtId.trim() : undefined;

  if (!ownedBudgetPlanId) return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
  if (!name) return badRequest("Name is required");
  if (!Number.isFinite(amount) || amount < 0) return badRequest("Amount must be a number >= 0");
  if (!Number.isFinite(month) || month < 1 || month > 12) return badRequest("Invalid month");
  if (!Number.isFinite(year) || year < 1900) return badRequest("Invalid year");

  // Build the list of years to distribute across, spanning the plan's budget horizon
  let targetYears: number[];
  if (distributeYears) {
    const planMeta = await prisma.budgetPlan.findUnique({
      where: { id: ownedBudgetPlanId },
      select: { budgetHorizonYears: true },
    });
    const horizon = Math.max(2, Math.floor(Number(planMeta?.budgetHorizonYears ?? 2)));
    targetYears = Array.from({ length: horizon }, (_, i) => year + i);
  } else {
    targetYears = [year];
  }

  // Build the list of months for a given year
  function monthsForYear(y: number): MonthKey[] {
    if (!distributeMonths) return [MONTHS[month - 1] as MonthKey];
    const start = y === year ? month - 1 : 0;
    return (MONTHS as MonthKey[]).slice(start);
  }

  const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const logo = await resolveExpenseLogoWithSearch(name);

  for (const y of targetYears) {
    await addOrUpdateExpenseAcrossMonths(ownedBudgetPlanId, y, monthsForYear(y), {
      id: sharedId,
      name,
      merchantDomain: logo.merchantDomain ?? undefined,
      amount,
      categoryId,
      paid,
      paidAmount: paid ? amount : 0,
      isAllocation,
      isDirectDebit,
      dueDate,
      paymentSource,
      cardDebtId: cardDebtId || undefined,
    } as any);
  }

  // Fetch back the primary record to return it
  const created = await prisma.expense.findFirst({
    where: { budgetPlanId: ownedBudgetPlanId, month, year, name },
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!created) return NextResponse.json({ error: "Expense was not created" }, { status: 500 });

  // Record payment source when expense is marked paid, mirroring web server-action logic
  if (paid) {
    try {
      const expensePayment = (prisma as any)?.expensePayment ?? null;
      if (expensePayment && amount > 0) {
        if (paymentSource === "credit_card") {
          // Resolve which card to charge
          let resolvedCardId = cardDebtId ?? "";
          if (!resolvedCardId) {
            const cards = await prisma.debt.findMany({
              where: { budgetPlanId: ownedBudgetPlanId, sourceType: null, type: { in: ["credit_card", "store_card"] } },
              select: { id: true },
              orderBy: { createdAt: "asc" },
            });
            if (cards.length === 1) resolvedCardId = cards[0]!.id;
          }
          if (resolvedCardId) {
            await expensePayment.create({
              data: { expenseId: created.id, amount, source: "credit_card", paidAt: new Date() },
            });
            // Increase card's current balance by the charged amount
            await prisma.$transaction(async (tx: any) => {
              const card = await tx.debt.findFirst({
                where: { id: resolvedCardId, budgetPlanId: ownedBudgetPlanId, sourceType: null },
                select: { id: true, currentBalance: true, initialBalance: true, paidAmount: true },
              });
              if (!card) return;
              const current = Number(card.currentBalance?.toString?.() ?? card.currentBalance ?? 0);
              const initial = Number(card.initialBalance?.toString?.() ?? card.initialBalance ?? 0);
              const paid_ = Number(card.paidAmount?.toString?.() ?? card.paidAmount ?? 0);
              const nextCurrent = Math.max(0, current + amount);
              const nextInitial = Math.max(initial, nextCurrent);
              await tx.debt.update({
                where: { id: card.id },
                data: {
                  currentBalance: String(nextCurrent),
                  initialBalance: String(nextInitial),
                  paidAmount: String(Math.min(Math.max(0, paid_), nextInitial)),
                  paid: false,
                },
              });
            });
          }
        } else if (paymentSource === "savings") {
          await expensePayment.create({
            data: { expenseId: created.id, amount, source: "savings", paidAt: new Date() },
          });
          const settings = await getSettings(ownedBudgetPlanId);
          const current = Number(settings.savingsBalance ?? 0);
          await saveSettings(ownedBudgetPlanId, { savingsBalance: Math.max(0, current - amount) });
        } else {
          // income or extra_untracked
          await expensePayment.create({
            data: { expenseId: created.id, amount, source: paymentSource, paidAt: new Date() },
          });
        }
      }
    } catch {
      // Payment recording is best-effort — never fail the expense creation
    }
  }

  // Fire threshold push in background — never blocks the response
  if (!isAllocation && categoryId && userId) {
    void maybeSendCategoryThresholdPush({
      budgetPlanId: ownedBudgetPlanId,
      categoryId,
      categoryName: (created as any).category?.name ?? null,
      month,
      year,
      userId,
      amountDelta: amount,
    });
  }

  return NextResponse.json(serializeExpense(created), { status: 201 });
}
