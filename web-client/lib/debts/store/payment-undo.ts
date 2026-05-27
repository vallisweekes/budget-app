import { prisma } from "@/lib/prisma";
import { resolveDebtPlannedPaymentTarget } from "@/lib/debts/plannedPaymentOverrides";
import { paymentSelect, paymentMonthKeyFromDate, decimalToNumber } from "./shared";
import { serializePayment } from "./transforms";

function addMonthsUtcWithDay(base: Date, monthOffset: number, dayOfMonth: number): Date {
	const year = base.getUTCFullYear();
	const month = base.getUTCMonth() + monthOffset;
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const clampedDay = Math.max(1, Math.min(daysInMonth, Math.trunc(dayOfMonth)));
	return new Date(Date.UTC(year, month, clampedDay, 0, 0, 0, 0));
}

function computeMonthlyDueAmount(debt: {
	amount: unknown;
	monthlyMinimum?: unknown;
	installmentMonths?: unknown;
	initialBalance?: unknown;
	currentBalance?: unknown;
}): number {
	const rawPlanned = decimalToNumber(debt.amount);
	let planned = Number.isFinite(rawPlanned) ? rawPlanned : 0;

	const installmentMonths = Math.max(0, Math.trunc(decimalToNumber(debt.installmentMonths)));
	if (!(planned > 0) && installmentMonths > 0) {
		const principal = (() => {
			const initial = decimalToNumber(debt.initialBalance);
			if (Number.isFinite(initial) && initial > 0) return initial;
			const current = decimalToNumber(debt.currentBalance);
			return Number.isFinite(current) ? current : 0;
		})();
		if (principal > 0) planned = principal / installmentMonths;
	}

	const monthlyMinimum = Math.max(0, decimalToNumber(debt.monthlyMinimum));
	if (monthlyMinimum > 0) planned = Math.max(planned, monthlyMinimum);

	return Math.max(0, planned);
}

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
		select: { ...paymentSelect(), periodKey: true },
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
			select: {
				id: true,
				currentBalance: true,
				paidAmount: true,
				amount: true,
				monthlyMinimum: true,
				installmentMonths: true,
				initialBalance: true,
				dueDate: true,
				dueDay: true,
			},
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

		const baseMonthlyPayment = Math.max(
			0,
			computeMonthlyDueAmount({
				amount: targetDebt.amount,
				monthlyMinimum: targetDebt.monthlyMinimum,
				installmentMonths: targetDebt.installmentMonths,
				initialBalance: targetDebt.initialBalance,
				currentBalance: nextBalance,
			})
		);

		const periodKey = String(paymentRow.periodKey ?? "").trim();
		if (periodKey) {
			const overrideTarget = await resolveDebtPlannedPaymentTarget({
				budgetPlanId,
				dueDate: targetDebt.dueDate,
				dueDay: targetDebt.dueDay,
				targetPeriodKey: periodKey,
			});
			const periodAgg = await tx.debtPayment.aggregate({
				where: { debtId, periodKey },
				_sum: { amount: true },
			});
			const paidThisPeriod = Math.max(0, decimalToNumber(periodAgg._sum.amount));

			if (overrideTarget) {
				if (paidThisPeriod > baseMonthlyPayment + 0.009) {
					await tx.debtPlannedPaymentOverride.upsert({
						where: {
							debtId_periodKey: {
								debtId,
								periodKey: overrideTarget.periodKey,
							},
						},
						update: { amount: paidThisPeriod },
						create: {
							debtId,
							year: overrideTarget.year,
							month: overrideTarget.month,
							periodKey: overrideTarget.periodKey,
							amount: paidThisPeriod,
						},
					});
				} else {
					await tx.debtPlannedPaymentOverride.deleteMany({
						where: {
							debtId,
							periodKey: overrideTarget.periodKey,
						},
					});
				}
			}
		}

		if (targetDebt.dueDate && Number.isFinite(targetDebt.dueDate.getTime()) && baseMonthlyPayment > 0) {
			const dueDay = Number.isFinite(targetDebt.dueDay as number) && (targetDebt.dueDay as number) > 0
				? Math.trunc(targetDebt.dueDay as number)
				: targetDebt.dueDate.getUTCDate();
			const previousDue = addMonthsUtcWithDay(targetDebt.dueDate, -1, dueDay);
			if (paymentRow.paidAt.getTime() <= previousDue.getTime()) {
				const cycleStart = addMonthsUtcWithDay(targetDebt.dueDate, -2, dueDay);
				const cycleAgg = await tx.debtPayment.aggregate({
					where: {
						debtId,
						paidAt: { gt: cycleStart, lte: previousDue },
					},
					_sum: { amount: true },
				});
				const paidTowardPreviousDue = Math.max(0, decimalToNumber(cycleAgg._sum.amount));
				if (paidTowardPreviousDue + 0.009 < baseMonthlyPayment) {
					await tx.debt.update({
						where: { id: targetDebt.id },
						data: { dueDate: previousDue, paid: nextBalance === 0 },
					});
				}
			}
		}
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
