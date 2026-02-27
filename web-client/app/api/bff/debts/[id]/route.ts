import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { processMissedDebtPaymentsToAccrue } from "@/lib/debts/carryover";
import { computeDebtPayoffProjection } from "@/lib/debts/payoffProjection";

export const runtime = "nodejs";

function parseDueDateInput(value: unknown): { ok: true; dueDate: Date | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, dueDate: null };

  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? { ok: true, dueDate: value }
      : { ok: false, error: "Invalid dueDate" };
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { ok: true, dueDate: null };

    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (ymd) {
      const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
      return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
    }

    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (dmy) {
      const d = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000Z`);
      return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
    }

    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
  }

  return { ok: false, error: "Invalid dueDate" };
}

function parseOptionalInt(value: unknown): { ok: true; int: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, int: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, error: "Invalid number" };
    return { ok: true, int: Math.trunc(value) };
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { ok: true, int: null };
    const parsed = Number.parseInt(s, 10);
    if (!Number.isFinite(parsed)) return { ok: false, error: "Invalid number" };
    return { ok: true, int: parsed };
  }
  return { ok: false, error: "Invalid number" };
}

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function withMissedPaymentFlag<T extends { sourceType?: string | null }>(debt: T): T & { isMissedPayment: boolean } {
  return {
    ...debt,
    isMissedPayment: debt.sourceType === "expense",
  };
}

function withPayoffProjection<T extends {
  currentBalance?: unknown;
  amount?: unknown;
  monthlyMinimum?: unknown;
  installmentMonths?: unknown;
  initialBalance?: unknown;
  interestRate?: unknown;
}>(debt: T): T & {
  computedMonthlyPayment: number;
  computedMonthsLeft: number | null;
  computedPaidOffBy: string | null;
} {
  const projection = computeDebtPayoffProjection({
    currentBalance: (debt as any).currentBalance,
    plannedMonthlyPayment: (debt as any).amount,
    monthlyMinimum: (debt as any).monthlyMinimum,
    installmentMonths: (debt as any).installmentMonths,
    initialBalance: (debt as any).initialBalance,
    interestRatePct: (debt as any).interestRate,
    maxMonths: 60,
  });

  return {
    ...(debt as any),
    ...projection,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in (value as any) && typeof (value as any).toNumber === "function") {
    return Number((value as any).toNumber());
  }
  if (value && typeof value === "object" && "toString" in (value as any) && typeof (value as any).toString === "function") {
    return Number((value as any).toString());
  }
  return Number(value as any);
}

function mapDebtPaymentSourceToExpensePaymentSource(source: unknown): "income" | "extra_untracked" {
  return source === "income" ? "income" : "extra_untracked";
}

function paymentMatchKey(p: { amount: number; paidAt: Date }) {
  return `${p.amount.toFixed(2)}|${p.paidAt.toISOString()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: {
				budgetPlan: { select: { userId: true } },
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!debt || debt.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    await processMissedDebtPaymentsToAccrue(debt.budgetPlanId);

    const refreshedDebt = await prisma.debt.findUnique({
      where: { id },
      include: {
        budgetPlan: { select: { userId: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!refreshedDebt || refreshedDebt.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

		const { budgetPlan, ...safe } = refreshedDebt;

    // Data integrity: for regular debts, `paidAmount` should equal the sum of recorded debt payments.
    // (Expense-derived debts can be affected by Expense payments that aren't mirrored as DebtPayment rows.)
    if (safe.sourceType !== "expense") {
      const paidAgg = await prisma.debtPayment.aggregate({
        where: { debtId: safe.id },
        _sum: { amount: true },
      });
      const computedPaid = Number((paidAgg._sum.amount as any)?.toString?.() ?? paidAgg._sum.amount ?? 0);
      const currentPaid = Number((safe.paidAmount as any)?.toString?.() ?? safe.paidAmount ?? 0);
      if (Number.isFinite(computedPaid) && Math.abs(computedPaid - currentPaid) > 0.009) {
        await prisma.debt.update({
          where: { id: safe.id },
          data: { paidAmount: computedPaid },
        });
        (safe as any).paidAmount = String(computedPaid);
      }
    } else if (safe.sourceExpenseId) {
      const expenseId = String(safe.sourceExpenseId).trim();
      if (expenseId) {
        const [expense, debtPayments, expensePayments] = await Promise.all([
          prisma.expense.findUnique({
            where: { id: expenseId },
            select: { id: true, amount: true },
          }),
          prisma.debtPayment.findMany({
            where: { debtId: safe.id },
            orderBy: { paidAt: "desc" },
          }),
          prisma.expensePayment.findMany({
            where: { expenseId },
            orderBy: { paidAt: "desc" },
          }),
        ]);

        if (expense) {
          const existingExpenseKeys = new Set(
            expensePayments.map((p) => paymentMatchKey({ amount: toNumber(p.amount), paidAt: p.paidAt }))
          );
          const toBackfill = debtPayments
            .map((p) => ({
              amount: toNumber(p.amount),
              paidAt: p.paidAt,
              source: mapDebtPaymentSourceToExpensePaymentSource((p as any).source),
            }))
            .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
            .filter((p) => !existingExpenseKeys.has(paymentMatchKey({ amount: p.amount, paidAt: p.paidAt })));

          if (toBackfill.length) {
            await prisma.expensePayment.createMany({
              data: toBackfill.map((p) => ({
                expenseId,
                amount: String(p.amount),
                source: p.source,
                debtId: safe.id,
                paidAt: p.paidAt,
              })),
            });
            for (const p of toBackfill) {
              expensePayments.push({
                id: `backfill_${p.paidAt.getTime()}_${p.amount}`,
                expenseId,
                amount: p.amount as any,
                source: p.source as any,
                debtId: safe.id,
                paidAt: p.paidAt,
                createdAt: p.paidAt,
                updatedAt: p.paidAt,
              } as any);
            }
          }

          const totalPaidRaw = expensePayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
          const expenseAmount = toNumber(expense.amount);
          const nextExpensePaid = Math.min(expenseAmount, Math.max(0, totalPaidRaw));
          const nextIsPaid = expenseAmount > 0 && nextExpensePaid >= expenseAmount;
          const nextDebtBalance = Math.max(0, expenseAmount - nextExpensePaid);

          const currentPaid = toNumber(safe.paidAmount);
          const currentBalance = toNumber(safe.currentBalance);
          if (
            Number.isFinite(nextExpensePaid) &&
            (Math.abs(nextExpensePaid - currentPaid) > 0.009 || Math.abs(nextDebtBalance - currentBalance) > 0.009)
          ) {
            await prisma.$transaction(async (tx) => {
              await tx.debt.update({
                where: { id: safe.id },
                data: {
                  paidAmount: String(nextExpensePaid),
                  currentBalance: String(nextDebtBalance),
                  paid: nextDebtBalance === 0,
                },
              });
              await tx.expense.update({
                where: { id: expenseId },
                data: {
                  paidAmount: String(nextExpensePaid),
                  paid: nextIsPaid,
                },
              });
            });
            (safe as any).paidAmount = String(nextExpensePaid);
            (safe as any).currentBalance = String(nextDebtBalance);
            (safe as any).paid = nextDebtBalance === 0;
          }
        }
      }
    }

    return NextResponse.json(withPayoffProjection(withMissedPaymentFlag(safe)));
  } catch (error) {
    console.error("Failed to fetch debt:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const existing = await prisma.debt.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!existing || existing.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.name === "string") data.name = raw.name;
    if (typeof raw.type === "string") data.type = raw.type;
    if (typeof raw.initialBalance !== "undefined") data.initialBalance = raw.initialBalance;
    if (typeof raw.currentBalance !== "undefined") data.currentBalance = raw.currentBalance;
    if (typeof raw.amount !== "undefined") data.amount = raw.amount;
    if (typeof raw.paid === "boolean") data.paid = raw.paid;
    if (typeof raw.paidAmount !== "undefined") data.paidAmount = raw.paidAmount;
    if (typeof raw.monthlyMinimum !== "undefined") data.monthlyMinimum = raw.monthlyMinimum;
    if (typeof raw.interestRate !== "undefined") data.interestRate = raw.interestRate;
    if (typeof raw.dueDate !== "undefined") {
      const parsed = parseDueDateInput(raw.dueDate);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      data.dueDate = parsed.dueDate;
    }
    if (typeof raw.dueDay !== "undefined") {
      const parsed = parseOptionalInt(raw.dueDay);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid dueDay" }, { status: 400 });
      data.dueDay = parsed.int;
    }
    if (typeof raw.installmentMonths !== "undefined") {
      const parsed = parseOptionalInt(raw.installmentMonths);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid installmentMonths" }, { status: 400 });
      data.installmentMonths = parsed.int;
    }
    if (typeof raw.creditLimit !== "undefined") data.creditLimit = raw.creditLimit;
    if (typeof raw.defaultPaymentSource !== "undefined") data.defaultPaymentSource = raw.defaultPaymentSource;
    if (typeof raw.defaultPaymentCardDebtId !== "undefined") data.defaultPaymentCardDebtId = raw.defaultPaymentCardDebtId;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const debt = await prisma.debt.update({
      where: { id },
      data,
    });

    return NextResponse.json(withMissedPaymentFlag(debt));
  } catch (error) {
    console.error("Failed to update debt:", error);
    return NextResponse.json(
      { error: "Failed to update debt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
		const existing = await prisma.debt.findUnique({
			where: { id },
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!existing || existing.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Debt not found" }, { status: 404 });
		}
    if (existing.sourceType === "expense" && Number(existing.currentBalance) > 0) {
      return NextResponse.json(
        { error: "Cannot delete an unpaid expense debt. Mark the expense as paid first." },
        { status: 409 }
      );
    }

    await prisma.debt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete debt:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 }
    );
  }
}
