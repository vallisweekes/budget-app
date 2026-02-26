import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
  // PaidAt is stored at ms precision; normalize to ISO for stable matching.
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
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!debt || debt.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Debt not found" }, { status: 404 });
		}

    const debtPayments = await prisma.debtPayment.findMany({
      where: { debtId: id },
      orderBy: { paidAt: "desc" },
    });

    // For expense-derived debts, `paidAmount` can drift if Expense payments were applied without
    // creating ExpensePayment rows (or vice versa). We self-heal by:
    // 1) backfilling missing ExpensePayment rows from DebtPayment rows,
    // 2) returning a merged, de-duplicated history (DebtPayment + any additional ExpensePayment rows).
    if (debt.sourceType === "expense" && debt.sourceExpenseId) {
      const expenseId = debt.sourceExpenseId;

      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        select: { id: true, amount: true },
      });
      if (!expense) {
        return NextResponse.json(debtPayments);
      }

      const existingExpensePayments = await prisma.expensePayment.findMany({
        where: { expenseId },
        orderBy: { paidAt: "desc" },
      });

      const existingExpenseKeys = new Set(
        existingExpensePayments.map((p) => paymentMatchKey({ amount: toNumber(p.amount), paidAt: p.paidAt }))
      );

      const toBackfill = debtPayments
        .map((p) => ({
          amount: toNumber(p.amount),
          paidAt: p.paidAt,
          source: mapDebtPaymentSourceToExpensePaymentSource((p as any).source),
          debtId: id,
        }))
        .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
        .filter((p) => !existingExpenseKeys.has(paymentMatchKey({ amount: p.amount, paidAt: p.paidAt })));

      if (toBackfill.length) {
        await prisma.expensePayment.createMany({
          data: toBackfill.map((p) => ({
            expenseId,
            amount: String(p.amount),
            source: p.source,
            debtId: p.debtId,
            paidAt: p.paidAt,
          })),
        });

        // Update in-memory list for downstream merge + reconciliation.
        for (const p of toBackfill) {
          existingExpensePayments.push({
            id: `backfill_${p.paidAt.getTime()}_${p.amount}`,
            expenseId,
            amount: p.amount as any,
            source: p.source as any,
            debtId: id,
            paidAt: p.paidAt,
            createdAt: p.paidAt,
            updatedAt: p.paidAt,
          } as any);
        }
      }

      // Merge history: show all DebtPayment rows, plus any additional ExpensePayment rows
      // that don't already have an equivalent DebtPayment (amount+paidAt).
      const debtKeys = new Set(
        debtPayments.map((p) => paymentMatchKey({ amount: toNumber(p.amount), paidAt: p.paidAt }))
      );

      const extraExpensePayments = existingExpensePayments.filter((p) => {
        const key = paymentMatchKey({ amount: toNumber(p.amount), paidAt: p.paidAt });
        return !debtKeys.has(key);
      });

      const normalizedExpenseAsDebtPayments = extraExpensePayments.map((p) => ({
        id: p.id,
        debtId: id,
        amount: String(toNumber(p.amount)),
        paidAt: p.paidAt,
        year: p.paidAt.getUTCFullYear(),
        month: p.paidAt.getUTCMonth() + 1,
        source: undefined,
        notes: null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      const merged = [...debtPayments, ...normalizedExpenseAsDebtPayments].sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );

      // Reconcile stored totals against the source-of-truth payment rows.
      const totalPaidRaw = existingExpensePayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
			const expenseAmount = toNumber(expense.amount);
      const nextPaidAmount = Math.min(expenseAmount, Math.max(0, totalPaidRaw));
      const nextBalance = Math.max(0, expenseAmount - nextPaidAmount);
      const nextIsPaid = expenseAmount > 0 && nextPaidAmount >= expenseAmount;

      await prisma.$transaction(async (tx) => {
        await tx.debt.update({
          where: { id },
          data: {
            paidAmount: String(nextPaidAmount),
            currentBalance: String(nextBalance),
            paid: nextIsPaid,
          },
        });
        await tx.expense.update({
          where: { id: expenseId },
          data: {
            paidAmount: String(nextPaidAmount),
            paid: nextIsPaid,
          },
        });
      });

      return NextResponse.json(merged);
    }

    return NextResponse.json(debtPayments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const paymentAmount = Number(body.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return badRequest("amount must be a number > 0");
    }

		const paymentSource = body.source === "extra_funds" ? "extra_funds" : "income";

    const debt = await prisma.debt.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!debt || debt.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

		const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
		const year = paidAt.getUTCFullYear();
		const month = paidAt.getUTCMonth() + 1;

    const appliedAmount = Math.min(paymentAmount, debt.currentBalance.toNumber());

    // Create payment + update debt (and linked expense when applicable) atomically
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.debtPayment.create({
        data: {
          debtId: id,
          amount: String(appliedAmount),
          paidAt,
          year,
          month,
          source: paymentSource,
          notes: body.notes || null,
        },
      });

      const nextDebtBalance = Math.max(0, debt.currentBalance.toNumber() - appliedAmount);
      const nextDebtPaidAmount = Math.max(0, debt.paidAmount.toNumber() + appliedAmount);

      const updatedDebt = await tx.debt.update({
        where: { id },
        data: {
          currentBalance: nextDebtBalance,
          paidAmount: nextDebtPaidAmount,
          paid: nextDebtBalance === 0,
        },
        select: { sourceType: true, sourceExpenseId: true },
      });

      if (updatedDebt.sourceType === "expense" && updatedDebt.sourceExpenseId) {
        const sourceExpense = await tx.expense.findUnique({
          where: { id: updatedDebt.sourceExpenseId },
          select: { id: true, amount: true, paidAmount: true },
        });

        if (sourceExpense) {
          const sourceAmount = Number(sourceExpense.amount.toString());

          // Record an ExpensePayment row so that expense-derived debts can be reconciled from payment history.
          await tx.expensePayment.create({
            data: {
              expenseId: sourceExpense.id,
              amount: String(appliedAmount),
              paidAt,
              debtId: id,
              source: mapDebtPaymentSourceToExpensePaymentSource(paymentSource),
            },
          });

          // Recompute totals from payment history to avoid drift.
          const paidAgg = await tx.expensePayment.aggregate({
            where: { expenseId: sourceExpense.id },
            _sum: { amount: true },
          });
          const totalExpensePaid = toNumber(paidAgg._sum.amount ?? 0);
          const nextSourcePaid = Math.min(sourceAmount, Math.max(0, totalExpensePaid));
          const nextSourceIsPaid = sourceAmount > 0 && nextSourcePaid >= sourceAmount;

          await tx.expense.update({
            where: { id: sourceExpense.id },
            data: {
              paidAmount: String(nextSourcePaid),
              paid: nextSourceIsPaid,
            },
          });

          // Keep the linked debt consistent with the expense totals.
          const nextDebtBalanceFromExpense = Math.max(0, sourceAmount - nextSourcePaid);
          await tx.debt.update({
            where: { id },
            data: {
              currentBalance: String(nextDebtBalanceFromExpense),
              paidAmount: String(nextSourcePaid),
              paid: nextDebtBalanceFromExpense === 0,
            },
          });
        }
      }

      return created;
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
