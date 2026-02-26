import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { processMissedDebtPaymentsToAccrue } from "@/lib/debts/carryover";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function withMissedPaymentFlag<T extends { sourceType?: string | null }>(debt: T): T & { isMissedPayment: boolean } {
  return {
    ...debt,
    isMissedPayment: debt.sourceType === "expense",
  };
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
    }

    return NextResponse.json(withMissedPaymentFlag(safe));
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
    if (typeof raw.dueDate !== "undefined") data.dueDate = raw.dueDate;
    if (typeof raw.dueDay !== "undefined") data.dueDay = raw.dueDay;
    if (typeof raw.installmentMonths !== "undefined") data.installmentMonths = raw.installmentMonths;
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
