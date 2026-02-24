import { prisma } from "@/lib/prisma";

function prismaDebtHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.Debt?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

const DEBT_HAS_LAST_ACCRUAL_MONTH = prismaDebtHasField("lastAccrualMonth");
const DEBT_HAS_DUE_DATE = prismaDebtHasField("dueDate");
const DEBT_HAS_DUE_DAY = prismaDebtHasField("dueDay");

function addMonthsUTC(date: Date, deltaMonths: number): Date {
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth();
	const d = date.getUTCDate();
	const target = new Date(Date.UTC(y, m + deltaMonths, 1));
	const daysInTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, daysInTargetMonth)));
}

function monthKeyUTC(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

function prevMonthKeyUTC(date: Date): string {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
	d.setUTCMonth(d.getUTCMonth() - 1);
	return monthKeyUTC(d);
}

function parseMonthKey(key: string): { year: number; month: number } | null {
	const match = String(key ?? "").trim().match(/^([0-9]{4})-([0-9]{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
	return { year, month };
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

/**
 * Missed payment accumulation:
 * - Preferred (new) behavior: debts with a `dueDate` use a calendar date with a 5-day grace window.
 *   When `now > dueDate + 5 days`, any unpaid remainder (vs `amount`) is accrued into BOTH
 *   `currentBalance` and `initialBalance`, and the debt's `dueDate` is rolled forward by 1 month.
 * - Legacy behavior: debts with only a `dueDay` accrue once per month (for the previous month) when
 *   paid < `amount`, using `lastAccrualMonth` for idempotency.
 */
export async function processMissedDebtPaymentsToAccrue(budgetPlanId: string, now: Date = new Date()) {
	const msPerDay = 24 * 60 * 60 * 1000;

	// New behavior (calendar due date + 5-day grace):
	// - If now is more than 5 days after dueDate, treat the cycle as complete.
	// - If the user paid less than `amount` during the cycle (up to grace end), accrue the remainder.
	// - Roll `dueDate` forward by 1 month so it doesn't repeatedly re-accrue.
	if (DEBT_HAS_DUE_DATE) {
		const debts: any[] = await (prisma.debt as any).findMany({
			where: {
				budgetPlanId,
				dueDate: { not: null },
				currentBalance: { gt: 0 },
				OR: [{ sourceType: null }, { sourceType: { not: "expense" } }],
			},
			select: {
				id: true,
				amount: true,
				initialBalance: true,
				currentBalance: true,
				dueDate: true,
			},
		});

		if (debts.length > 0) {
			type EvaluableDebt = {
				id: string;
				dueAmount: number;
				prevDue: Date;
				graceEnd: Date;
				nextDue: Date;
			};

			const evaluableDebts: EvaluableDebt[] = debts
				.map((d) => {
					const due = new Date(d.dueDate);
					if (!Number.isFinite(due.getTime())) return null;
					const graceEnd = new Date(due.getTime() + 5 * msPerDay);
					if (now.getTime() <= graceEnd.getTime()) return null;

					return {
						id: d.id,
						dueAmount: decimalToNumber(d.amount),
						prevDue: addMonthsUTC(due, -1),
						graceEnd,
						nextDue: addMonthsUTC(due, 1),
					};
				})
				.filter((value): value is EvaluableDebt => value != null);

			const updates: Array<{ id: string; remaining: number; nextDue: Date }> = [];
			if (evaluableDebts.length > 0) {
				const minPrevDueTs = Math.min(...evaluableDebts.map((d) => d.prevDue.getTime()));
				const maxGraceEndTs = Math.max(...evaluableDebts.map((d) => d.graceEnd.getTime()));

				const debtWindowById = new Map(
					evaluableDebts.map((d) => [d.id, { prevDueTs: d.prevDue.getTime(), graceEndTs: d.graceEnd.getTime(), dueAmount: d.dueAmount, nextDue: d.nextDue }])
				);

				const candidatePayments = await prisma.debtPayment.findMany({
					where: {
						debtId: { in: evaluableDebts.map((d) => d.id) },
						paidAt: {
							gt: new Date(minPrevDueTs),
							lte: new Date(maxGraceEndTs),
						},
					},
					select: { debtId: true, amount: true, paidAt: true },
				});

				const paidByDebtId = new Map<string, number>();
				for (const payment of candidatePayments) {
					const window = debtWindowById.get(payment.debtId);
					if (!window) continue;
					const paidAtTs = new Date(payment.paidAt).getTime();
					if (paidAtTs <= window.prevDueTs || paidAtTs > window.graceEndTs) continue;
					const amount = decimalToNumber(payment.amount);
					if (!Number.isFinite(amount)) continue;
					paidByDebtId.set(payment.debtId, (paidByDebtId.get(payment.debtId) ?? 0) + amount);
				}

				for (const debt of evaluableDebts) {
					const paid = paidByDebtId.get(debt.id) ?? 0;
					updates.push({
						id: debt.id,
						remaining: Math.max(0, debt.dueAmount - paid),
						nextDue: debt.nextDue,
					});
				}
			}

			if (updates.length > 0) {
				await prisma.$transaction(
					updates.map((u) => {
						return (prisma.debt as any).update({
							where: { id: u.id },
							data: {
								dueDate: u.nextDue,
								...(u.remaining > 0
									? {
										currentBalance: { increment: u.remaining },
										initialBalance: { increment: u.remaining },
									}
									: {}),
							},
						});
					})
				);
			}
		}
	}

	// Legacy behavior (dueDay monthly accrual).
	if (!DEBT_HAS_LAST_ACCRUAL_MONTH || !DEBT_HAS_DUE_DAY) {
		// Dev-safety: if Prisma Client is stale, skip rather than crashing.
		return;
	}

	const prevKey = prevMonthKeyUTC(now);
	const prev = parseMonthKey(prevKey);
	if (!prev) return;

	// Use `any` here so TypeScript doesn't break when Prisma client types are stale.
	const debts: any[] = await (prisma.debt as any).findMany({
		where: {
			budgetPlanId,
			dueDay: { not: null },
			...(DEBT_HAS_DUE_DATE ? { dueDate: null } : {}),
			currentBalance: { gt: 0 },
			OR: [{ sourceType: null }, { sourceType: { not: "expense" } }],
		},
		select: {
			id: true,
			amount: true,
			initialBalance: true,
			currentBalance: true,
			lastAccrualMonth: true,
		},
	});

	if (debts.length === 0) return;

	const payments = await prisma.debtPayment.findMany({
		where: {
			debt: { budgetPlanId },
			year: prev.year,
			month: prev.month,
		},
		select: { debtId: true, amount: true },
	});

	const paidByDebt = new Map<string, number>();
	for (const p of payments) {
		const amt = decimalToNumber(p.amount);
		paidByDebt.set(p.debtId, (paidByDebt.get(p.debtId) ?? 0) + (Number.isFinite(amt) ? amt : 0));
	}

	const updates: Array<{ id: string; remaining: number }> = debts
		.filter((d) => (d.lastAccrualMonth ?? "") !== prevKey)
		.map((d) => {
			const due = decimalToNumber(d.amount);
			const paid = paidByDebt.get(d.id) ?? 0;
			const remaining = Math.max(0, due - paid);
			return { id: d.id, remaining };
		});

	if (updates.length === 0) return;

	await prisma.$transaction(
		updates.map((u) => {
			return (prisma.debt as any).update({
				where: { id: u.id },
				data: {
					lastAccrualMonth: prevKey,
					...(u.remaining > 0
						? {
							currentBalance: { increment: u.remaining },
							initialBalance: { increment: u.remaining },
						}
						: {}),
				},
			});
		})
	);
}
