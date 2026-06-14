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
const DEBT_HAS_IS_DIRECT_DEBIT = prismaDebtHasField("isDirectDebit");

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

function computeMonthlyDueAmount(row: {
	amount: unknown;
	monthlyMinimum?: unknown;
	installmentMonths?: unknown;
	initialBalance?: unknown;
	currentBalance?: unknown;
}): number {
	const rawPlanned = decimalToNumber(row.amount);
	let planned = Number.isFinite(rawPlanned) ? rawPlanned : 0;

	const installmentMonthsRaw = decimalToNumber(row.installmentMonths);
	const installmentMonths = Number.isFinite(installmentMonthsRaw) ? Math.max(0, Math.trunc(installmentMonthsRaw)) : 0;
	if (!(planned > 0) && installmentMonths > 0) {
		const initial = decimalToNumber(row.initialBalance);
		const current = decimalToNumber(row.currentBalance);
		const principal = initial > 0 ? initial : current;
		if (principal > 0) planned = principal / installmentMonths;
	}

	const rawMin = decimalToNumber(row.monthlyMinimum);
	const min = Number.isFinite(rawMin) ? Math.max(0, rawMin) : 0;
	if (min > 0) planned = Math.max(planned, min);

	return Math.max(0, planned);
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
				monthlyMinimum: true,
				installmentMonths: true,
				initialBalance: true,
				currentBalance: true,
				dueDate: true,
			},
		});

		if (debts.length > 0) {
			const startOfUtcDay = (date: Date) =>
				new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

			const graceEndExclusiveUtc = (dueDate: Date) => {
				const dueStart = startOfUtcDay(dueDate);
				// Full 5-day grace means accrual starts at the beginning of day 6 after due date.
				return new Date(dueStart.getTime() + 6 * msPerDay);
			};

			type EvaluableDebt = {
				id: string;
				dueAmount: number;
				prevDue: Date;
				graceEndExclusive: Date;
				nextDue: Date;
				endTs: number;
				nowPastGrace: boolean;
			};

			const evaluableDebts: EvaluableDebt[] = debts
				.map((d) => {
					const due = new Date(d.dueDate);
					if (!Number.isFinite(due.getTime())) return null;
					const dueAmount = computeMonthlyDueAmount(d);
					if (!(dueAmount > 0)) return null;
					const graceEndExclusive = graceEndExclusiveUtc(due);
					const nowTs = now.getTime();
					const graceEndExclusiveTs = graceEndExclusive.getTime();
					const endTs = Math.min(nowTs, graceEndExclusiveTs - 1);
					const nowPastGrace = nowTs >= graceEndExclusiveTs;

					return {
						id: d.id,
						dueAmount,
						prevDue: addMonthsUTC(due, -1),
						graceEndExclusive,
						nextDue: addMonthsUTC(due, 1),
						endTs,
						nowPastGrace,
					};
				})
				.filter((value): value is EvaluableDebt => value != null);

			const updates: Array<{ id: string; remaining: number; nextDue: Date; accrue: boolean }> = [];
			if (evaluableDebts.length > 0) {
				const minPrevDueTs = Math.min(...evaluableDebts.map((d) => d.prevDue.getTime()));
				const maxEndTs = Math.max(...evaluableDebts.map((d) => d.endTs));

				const debtWindowById = new Map(
					evaluableDebts.map((d) => [
						d.id,
						{
							prevDueTs: d.prevDue.getTime(),
							endTs: d.endTs,
							dueAmount: d.dueAmount,
							nextDue: d.nextDue,
							nowPastGrace: d.nowPastGrace,
						},
					])
				);

				const candidatePayments = await prisma.debtPayment.findMany({
					where: {
						debtId: { in: evaluableDebts.map((d) => d.id) },
						paidAt: {
							gt: new Date(minPrevDueTs),
							lte: new Date(maxEndTs),
						},
					},
					select: { debtId: true, amount: true, paidAt: true },
				});

				const paidByDebtId = new Map<string, number>();
				for (const payment of candidatePayments) {
					const window = debtWindowById.get(payment.debtId);
					if (!window) continue;
					const paidAtTs = new Date(payment.paidAt).getTime();
					if (paidAtTs <= window.prevDueTs || paidAtTs > window.endTs) continue;
					const amount = decimalToNumber(payment.amount);
					if (!Number.isFinite(amount)) continue;
					paidByDebtId.set(payment.debtId, (paidByDebtId.get(payment.debtId) ?? 0) + amount);
				}

				for (const debt of evaluableDebts) {
					const paid = paidByDebtId.get(debt.id) ?? 0;
					const remaining = Math.max(0, debt.dueAmount - paid);
					// If the cycle is fully covered, roll dueDate forward immediately.
					// Otherwise keep dueDate until grace end; once grace has passed, accrue the remainder and roll forward.
					if (remaining === 0 || debt.nowPastGrace) {
						updates.push({
							id: debt.id,
							remaining,
							nextDue: debt.nextDue,
							accrue: debt.nowPastGrace && remaining > 0,
						});
					}
				}
			}

			if (updates.length > 0) {
				await prisma.$transaction(
					updates.map((u) => {
						return (prisma.debt as any).update({
							where: { id: u.id },
							data: {
								dueDate: u.nextDue,
								...(u.accrue
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
			monthlyMinimum: true,
			installmentMonths: true,
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
			const due = computeMonthlyDueAmount(d);
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

/**
 * Direct debit auto-payment:
 * For any debt with `isDirectDebit = true` and a `dueDate` on or before `now`,
 * automatically record a payment for the computed monthly due amount if no payment
 * has already been recorded in the current cycle (between the previous due date
 * and the current due date).
 *
 * After recording the payment the dueDate is rolled forward by one month,
 * exactly as the missed-payment accrual does.
 *
 * This runs BEFORE `processMissedDebtPaymentsToAccrue` so the auto-payment
 * satisfies the cycle and prevents the missed-payment accrual from also firing.
 */
export async function processDirectDebitAutoPayments(budgetPlanId: string, now: Date = new Date()) {
	if (!DEBT_HAS_IS_DIRECT_DEBIT || !DEBT_HAS_DUE_DATE) return;

	const nowTs = now.getTime();

	const debts: any[] = await (prisma.debt as any).findMany({
		where: {
			budgetPlanId,
			isDirectDebit: true,
			dueDate: { not: null, lte: now },
			currentBalance: { gt: 0 },
			paid: false,
			OR: [{ sourceType: null }, { sourceType: { not: "expense" } }],
		},
		select: {
			id: true,
			amount: true,
			monthlyMinimum: true,
			installmentMonths: true,
			initialBalance: true,
			currentBalance: true,
			dueDate: true,
			defaultPaymentSource: true,
		},
	});

	if (debts.length === 0) return;

	// For each candidate, check whether a payment already exists this cycle.
	const toProcess: Array<{
		id: string;
		dueAmount: number;
		dueDate: Date;
		prevDue: Date;
		nextDue: Date;
		defaultPaymentSource: string;
	}> = [];

	for (const d of debts) {
		const due = new Date(d.dueDate);
		if (!Number.isFinite(due.getTime())) continue;
		const dueAmount = computeMonthlyDueAmount(d);
		if (!(dueAmount > 0)) continue;
		const prevDue = addMonthsUTC(due, -1);
		const nextDue = addMonthsUTC(due, 1);
		toProcess.push({
			id: d.id,
			dueAmount,
			dueDate: due,
			prevDue,
			nextDue,
			defaultPaymentSource: String(d.defaultPaymentSource ?? "income"),
		});
	}

	if (toProcess.length === 0) return;

	// Fetch existing payments in the cycle window for all candidates.
	const minPrevDue = new Date(Math.min(...toProcess.map((d) => d.prevDue.getTime())));
	const existingPayments = await prisma.debtPayment.findMany({
		where: {
			debtId: { in: toProcess.map((d) => d.id) },
			paidAt: { gt: minPrevDue, lte: now },
		},
		select: { debtId: true, paidAt: true },
	});

	const alreadyPaidIds = new Set<string>();
	for (const p of existingPayments) {
		const paidAt = new Date(p.paidAt).getTime();
		const candidate = toProcess.find((d) => d.id === p.debtId);
		if (!candidate) continue;
		const prevDueTs = candidate.prevDue.getTime();
		const dueDateTs = candidate.dueDate.getTime();
		if (paidAt > prevDueTs && paidAt <= dueDateTs + 24 * 60 * 60 * 1000) {
			alreadyPaidIds.add(p.debtId);
		}
	}

	const pending = toProcess.filter((d) => !alreadyPaidIds.has(d.id));
	if (pending.length === 0) return;

	await prisma.$transaction(async (tx) => {
		for (const d of pending) {
			const paymentAmount = Math.min(d.dueAmount, decimalToNumber(
				await tx.debt.findUnique({ where: { id: d.id }, select: { currentBalance: true } })
					.then((r) => r?.currentBalance ?? 0)
			));
			if (!(paymentAmount > 0)) continue;

			const source = d.defaultPaymentSource === "extra_funds" ? "extra_funds"
				: d.defaultPaymentSource === "credit_card" ? "credit_card"
				: "income";

			const nowYear = now.getUTCFullYear();
			const nowMonth = now.getUTCMonth() + 1;
			const periodKey = `${nowYear}-${String(nowMonth).padStart(2, "0")}`;

			await tx.debtPayment.create({
				data: {
					debtId: d.id,
					amount: paymentAmount,
					paidAt: now,
					year: nowYear,
					month: nowMonth,
					periodKey,
					source,
					notes: "Auto-recorded (direct debit)",
				},
			});

			const newBalance = Math.max(0, decimalToNumber(
				await tx.debt.findUnique({ where: { id: d.id }, select: { currentBalance: true } })
					.then((r) => r?.currentBalance ?? 0)
			) - paymentAmount);
			const nextPaidAmount = decimalToNumber(
				await tx.debt.findUnique({ where: { id: d.id }, select: { paidAmount: true } })
					.then((r) => r?.paidAmount ?? 0)
			) + paymentAmount;

			await (tx.debt as any).update({
				where: { id: d.id },
				data: {
					currentBalance: newBalance,
					paidAmount: nextPaidAmount,
					paid: newBalance <= 0,
					dueDate: d.nextDue,
				},
			});
		}
	});
}

