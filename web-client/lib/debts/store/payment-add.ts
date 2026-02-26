import type { DebtPayment } from "@/types";
import { prisma } from "@/lib/prisma";
import {
	DEBT_PAYMENT_HAS_CARD_DEBT_ID,
	paymentSelect,
	parseYearMonthKey,
	decimalToNumber,
} from "./shared";
import { serializePayment } from "./transforms";
type PaymentCreateData = Parameters<typeof prisma.debtPayment.create>[0]["data"];

function isCreditLikeDebtType(value: unknown): boolean {
	return value === "credit_card" || value === "store_card";
}

export async function addPayment(
	budgetPlanId: string,
	debtId: string,
	amount: number,
	month: string,
	source: "income" | "extra_funds" | "credit_card" = "income",
	cardDebtId?: string
): Promise<DebtPayment | null> {
	const paidAt = new Date();
	const parsed = parseYearMonthKey(month);
	const year = parsed?.year ?? paidAt.getUTCFullYear();
	const monthNum = parsed?.month ?? paidAt.getUTCMonth() + 1;

	if (source === "credit_card") {
		const trimmedCardId = String(cardDebtId ?? "").trim();
		if (!trimmedCardId) throw new Error("cardDebtId is required when source=credit_card");
		if (trimmedCardId === debtId) throw new Error("Cannot pay a debt using the same card");

		const [targetDebt, cardDebt] = await prisma.$transaction([
			prisma.debt.findFirst({
				where: { id: debtId, budgetPlanId },
				select: { id: true, type: true, currentBalance: true, paidAmount: true, sourceType: true, sourceExpenseId: true },
			}),
			prisma.debt.findFirst({
				where: { id: trimmedCardId, budgetPlanId },
				select: { id: true, type: true, currentBalance: true, paid: true, paidAmount: true },
			}),
		]);
		if (!targetDebt) return null;
		if (!cardDebt) throw new Error("Selected card not found");
		if (!isCreditLikeDebtType(cardDebt.type)) {
			throw new Error("Selected source must be a credit or store card");
		}

		const targetCurrentBalance = decimalToNumber(targetDebt.currentBalance);
		if (targetCurrentBalance <= 0) throw new Error("Debt is already paid");
		const appliedAmount = Math.min(amount, targetCurrentBalance);

		const payment = await prisma.$transaction(async (tx) => {
			const createdPayment = await tx.debtPayment.create({
				data: {
					debtId: targetDebt.id,
					amount: appliedAmount,
					paidAt,
					year,
					month: monthNum,
					source: "credit_card" as PaymentCreateData["source"],
					...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: trimmedCardId } : {}),
					notes: month ? `month:${month}` : null,
				},
				select: paymentSelect(),
			});

			const nextTargetBalance = Math.max(0, targetCurrentBalance - appliedAmount);
			const nextTargetPaid = Math.max(0, decimalToNumber(targetDebt.paidAmount) + appliedAmount);
			await tx.debt.update({
				where: { id: targetDebt.id },
				data: { currentBalance: nextTargetBalance, paidAmount: nextTargetPaid, paid: nextTargetBalance === 0 },
			});

			const nextCardBalance = Math.max(0, decimalToNumber(cardDebt.currentBalance) + appliedAmount);
			await tx.debt.update({
				where: { id: cardDebt.id },
				data: { currentBalance: nextCardBalance, paid: nextCardBalance === 0 },
			});
			return createdPayment;
		});
		return serializePayment(payment);
	}

	const debt = await prisma.debt.findFirst({
		where: { id: debtId, budgetPlanId },
		select: { id: true, currentBalance: true, paidAmount: true, sourceType: true, sourceExpenseId: true },
	});
	if (!debt) return null;

	const currentBalance = decimalToNumber(debt.currentBalance);
	if (currentBalance <= 0) throw new Error("Debt is already paid");
	const appliedAmount = Math.min(amount, currentBalance);

	const payment = await prisma.debtPayment.create({
		data: {
			debtId: debt.id,
			amount: appliedAmount,
			paidAt,
			year,
			month: monthNum,
			source: source === "extra_funds" ? "extra_funds" : "income",
			...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: cardDebtId ?? null } : {}),
			notes: month ? `month:${month}` : null,
		},
		select: paymentSelect(),
	});

	const newBalance = Math.max(0, currentBalance - appliedAmount);
	const newPaidAmount = Math.max(0, decimalToNumber(debt.paidAmount) + appliedAmount);
	await prisma.debt.update({
		where: { id: debt.id },
		data: { currentBalance: newBalance, paidAmount: newPaidAmount, paid: newBalance === 0 },
	});
	// NOTE: Expense-derived debts should sync their backing Expense via explicit callers
	// (and should create ExpensePayment rows), to avoid double-counting and drift.

	return serializePayment(payment);
}
