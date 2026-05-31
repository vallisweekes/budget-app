import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/api/bffAuth";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";
import { undoMostRecentPayment } from "@/lib/debts/store/payment-undo";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type NumericLike = {
	toNumber?: () => unknown;
	toString?: () => string;
};

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(value: unknown): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number(value);
	const numericLike = value as NumericLike | null;
	if (numericLike && typeof numericLike === "object" && typeof numericLike.toNumber === "function") {
		return Number(numericLike.toNumber());
	}
	if (numericLike && typeof numericLike === "object" && typeof numericLike.toString === "function") {
		return Number(numericLike.toString());
	}
	return Number(value);
}

function buildDebtPaymentLoggedExpenseSeriesKey(paymentId: string): string {
	return `debt-payment:${paymentId}`;
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; paymentId: string }> }
) {
	try {
		const userId = await getSessionUserId(request);
		if (!userId) return unauthorized();

		const { id, paymentId } = await params;
		const debt = await prisma.debt.findUnique({
			where: { id },
			select: {
				id: true,
				budgetPlanId: true,
				sourceType: true,
				sourceExpenseId: true,
				budgetPlan: { select: { userId: true } },
			},
		});

		if (!debt || debt.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Debt not found" }, { status: 404 });
		}

		const undone = await undoMostRecentPayment({
			budgetPlanId: debt.budgetPlanId,
			debtId: debt.id,
			paymentId,
		});

		if (debt.sourceType === "expense" && debt.sourceExpenseId) {
			await prisma.$transaction(async (tx) => {
				const matchingExpensePayment = await tx.expensePayment.findFirst({
					where: {
						expenseId: debt.sourceExpenseId as string,
						debtId: debt.id,
						paidAt: new Date(undone.paidAt),
						amount: undone.amount,
					},
					orderBy: [{ createdAt: "desc" }],
					select: { id: true },
				});

				if (matchingExpensePayment) {
					await tx.expensePayment.delete({ where: { id: matchingExpensePayment.id } });
				}

				const [expense, paidAgg, latestExpensePayment] = await Promise.all([
					tx.expense.findFirst({
						where: { id: debt.sourceExpenseId as string, budgetPlanId: debt.budgetPlanId },
						select: { id: true, amount: true },
					}),
					tx.expensePayment.aggregate({
						where: { expenseId: debt.sourceExpenseId as string },
						_sum: { amount: true },
					}),
					tx.expensePayment.findFirst({
						where: { expenseId: debt.sourceExpenseId as string },
						orderBy: [{ paidAt: "desc" }],
						select: { paidAt: true },
					}),
				]);

				if (!expense) return;

				const expenseAmount = Math.max(0, toNumber(expense.amount));
				const paidAmount = Math.min(expenseAmount, Math.max(0, toNumber(paidAgg._sum.amount)));
				const currentBalance = Math.max(0, expenseAmount - paidAmount);
				const isPaid = expenseAmount > 0 && currentBalance <= 0;

				await Promise.all([
					tx.expense.update({
						where: { id: expense.id },
						data: {
							paidAmount,
							paid: isPaid,
							lastPaymentAt: latestExpensePayment?.paidAt ?? null,
						},
					}),
					tx.debt.update({
						where: { id: debt.id },
						data: {
							paidAmount,
							currentBalance,
							paid: isPaid,
						},
					}),
				]);
			});
		}

		await prisma.expense.deleteMany({
			where: {
				budgetPlanId: debt.budgetPlanId,
				seriesKey: buildDebtPaymentLoggedExpenseSeriesKey(paymentId),
				isExtraLoggedExpense: true,
			},
		});

		await invalidateDashboardCache(debt.budgetPlanId);

		return NextResponse.json({ success: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Failed to undo payment";
		if (message === "Debt not found" || message === "Payment not found") {
			return NextResponse.json({ error: message }, { status: 404 });
		}
		return badRequest(message);
	}
}