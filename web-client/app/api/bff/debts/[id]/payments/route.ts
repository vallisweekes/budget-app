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

    const payments = await prisma.debtPayment.findMany({
      where: { debtId: id },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
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
          const sourcePaid = Number(sourceExpense.paidAmount.toString());
          const nextSourcePaid = Math.min(sourceAmount, Math.max(0, sourcePaid + appliedAmount));
          const nextSourceIsPaid = sourceAmount > 0 && nextSourcePaid >= sourceAmount;

          await tx.expense.update({
            where: { id: sourceExpense.id },
            data: {
              paidAmount: String(nextSourcePaid),
              paid: nextSourceIsPaid,
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
