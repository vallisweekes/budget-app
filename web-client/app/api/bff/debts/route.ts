import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const debts = await prisma.debt.findMany({
      where: { budgetPlanId },
      include: {
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(debts.map((debt) => withMissedPaymentFlag(debt)));
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = await request.json();

    // Backward compatible mapping: older clients may still send "high_purchase".
    // The DB enum value is now "hire_purchase".
    const normalizedType = body?.type === "high_purchase" ? "hire_purchase" : body?.type;
		const requestedBudgetPlanId = typeof body?.budgetPlanId === "string" ? body.budgetPlanId : "";
		if (!requestedBudgetPlanId.trim()) {
			return NextResponse.json({ error: "budgetPlanId is required" }, { status: 400 });
		}
		const budgetPlanId = await resolveOwnedBudgetPlanId({ userId, budgetPlanId: requestedBudgetPlanId });
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}
    const debt = await prisma.debt.create({
      data: {
        name: body.name,
				type: normalizedType,
        initialBalance: body.initialBalance,
        currentBalance: body.currentBalance || body.initialBalance,
        amount: body.amount,
        paid: body.paid || false,
        paidAmount: body.paidAmount || 0,
        monthlyMinimum: body.monthlyMinimum || null,
        interestRate: body.interestRate || null,
        installmentMonths: body.installmentMonths || null,
        dueDate: body.dueDate || null,
        dueDay: body.dueDay || null,
        creditLimit: body.creditLimit || null,
        defaultPaymentSource: body.defaultPaymentSource || "income",
        defaultPaymentCardDebtId: body.defaultPaymentCardDebtId || null,
        sourceType: body.sourceType || null,
        sourceExpenseId: body.sourceExpenseId || null,
        sourceMonthKey: body.sourceMonthKey || null,
        sourceCategoryId: body.sourceCategoryId || null,
        sourceCategoryName: body.sourceCategoryName || null,
        sourceExpenseName: body.sourceExpenseName || null,
        budgetPlanId,
      },
    });

    return NextResponse.json(withMissedPaymentFlag(debt), { status: 201 });
  } catch (error) {
    console.error("Failed to create debt:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}
