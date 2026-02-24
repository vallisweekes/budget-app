import { prisma } from "@/lib/prisma";
import { paymentSelect, paymentMonthKeyFromDate, decimalToNumber } from "./shared";
import { serializePayment } from "./transforms";

function isCreditLikeDebtType(value: unknown): boolean {
	return value === "credit_card" || value === "store_card";
}

function getCardDebtId(row: { cardDebtId?: string | null }): string | null | undefined {
	return row.cardDebtId;
}

export async function undoMostRecentPayment(params: {
	budgetPlanId: string;
	debtId: string;
	paymentId: string;
}): Promise<{ debtId: string; amount: number; source?: string; cardDebtId?: string; paidAt: string }> {
	const { budgetPlanId, debtId, paymentId } = params;
	const paymentRow = await prisma.debtPayment.findFirst({
		where: { id: paymentId, debtId, debt: { budgetPlanId } },
		select: paymentSelect(),
	});
	if (!paymentRow) throw new Error("Payment not found");

	const now = new Date();
	if (paymentMonthKeyFromDate(paymentRow.paidAt) !== paymentMonthKeyFromDate(now)) {
		throw new Error("You can only undo a payment in the same month it was made.");
	}

	const latest = await prisma.debtPayment.findFirst({
		where: { debtId, debt: { budgetPlanId } },
		orderBy: [{ paidAt: "desc" }],
		select: { id: true },
	});
	if (!latest || latest.id !== paymentRow.id) throw new Error("Only the most recent payment can be undone.");

	const amount = decimalToNumber(paymentRow.amount);
	if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid payment amount");

	await prisma.$transaction(async (tx) => {
		const targetDebt = await tx.debt.findFirst({
			where: { id: debtId, budgetPlanId },
			select: { id: true, currentBalance: true, paidAmount: true },
		});
		if (!targetDebt) throw new Error("Debt not found");

		const nextBalance = Math.max(0, decimalToNumber(targetDebt.currentBalance) + amount);
		const nextPaid = Math.max(0, decimalToNumber(targetDebt.paidAmount) - amount);
		await tx.debt.update({
			where: { id: targetDebt.id },
			data: { currentBalance: nextBalance, paidAmount: nextPaid, paid: nextBalance === 0 },
		});

		const source = paymentRow.source;
		const cardDebtId = getCardDebtId(paymentRow);
		if (source === "credit_card" && cardDebtId) {
			const cardDebt = await tx.debt.findFirst({
				where: { id: cardDebtId, budgetPlanId },
				select: { id: true, type: true, currentBalance: true },
			});
			if (!cardDebt) throw new Error("Card not found");
			if (!isCreditLikeDebtType(cardDebt.type)) {
				throw new Error("Selected source must be a credit or store card");
			}
			const cardBalance = decimalToNumber(cardDebt.currentBalance);
			if (cardBalance < amount) {
				throw new Error("Cannot undo this payment because the card balance has changed. Undo newer payments first.");
			}
			const nextCardBalance = Math.max(0, cardBalance - amount);
			await tx.debt.update({
				where: { id: cardDebt.id },
				data: { currentBalance: nextCardBalance, paid: nextCardBalance === 0 },
			});
		}

		await tx.debtPayment.delete({ where: { id: paymentRow.id } });
	});

	const serialized = serializePayment(paymentRow);
	return {
		debtId: serialized.debtId,
		amount: serialized.amount,
		source: serialized.source,
		cardDebtId: serialized.cardDebtId,
		paidAt: serialized.date,
	};
}
