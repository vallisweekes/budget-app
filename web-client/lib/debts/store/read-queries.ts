import type { DebtItem, DebtPayment, MonthKey } from "@/types";
import { normalizeCreditLikeCurrentBalance } from "@/lib/debts/cardBalanceSemantics";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { prisma } from "@/lib/prisma";
import {
	debtSelect,
	paymentSelect,
	decimalToNumber,
	DEBT_PAYMENT_HAS_CARD_DEBT_ID,
} from "./shared";
import {
	serializeDebt,
	serializePayment,
	isDebtTypeEnumMismatchError,
	resolveBudgetYear,
} from "./transforms";

async function normalizeDebtBalances(debts: DebtItem[]): Promise<DebtItem[]> {
	const candidateCardIds = debts
		.filter(
			(debt) =>
				(debt.type === "credit_card" || debt.type === "store_card") &&
				Number(debt.creditLimit ?? 0) > 0 &&
				Number(debt.currentBalance ?? 0) >= Number(debt.creditLimit ?? 0)
		)
		.map((debt) => debt.id);

	if (!candidateCardIds.length) return debts;

	const [expenseChargeRows, debtChargeRows, paymentRows] = await Promise.all([
		prisma.expensePayment.groupBy({
			by: ["debtId"],
			where: { debtId: { in: candidateCardIds } },
			_sum: { amount: true },
		}),
		DEBT_PAYMENT_HAS_CARD_DEBT_ID
			? prisma.debtPayment.groupBy({
					by: ["cardDebtId"],
					where: { cardDebtId: { in: candidateCardIds } },
					_sum: { amount: true },
			  })
			: Promise.resolve([]),
		prisma.debtPayment.groupBy({
			by: ["debtId"],
			where: { debtId: { in: candidateCardIds } },
			_sum: { amount: true },
		}),
	]);

	const expenseChargesByDebtId = new Map(
		expenseChargeRows.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
	);
	const debtChargesByDebtId = new Map(
		debtChargeRows.map((row) => [String(row.cardDebtId ?? ""), Number(row._sum.amount ?? 0)])
	);
	const paymentsByDebtId = new Map(
		paymentRows.map((row) => [row.debtId, Number(row._sum.amount ?? 0)])
	);
	const candidateCardIdSet = new Set(candidateCardIds);
	const normalizedDebts = debts.map((debt) => {
		if (!candidateCardIdSet.has(debt.id)) return debt;
		return {
			...debt,
			currentBalance: normalizeCreditLikeCurrentBalance({
				type: debt.type,
				currentBalance: debt.currentBalance,
				creditLimit: debt.creditLimit,
				trackedExpenseCharges: expenseChargesByDebtId.get(debt.id) ?? 0,
				trackedDebtCharges: debtChargesByDebtId.get(debt.id) ?? 0,
				trackedPayments: paymentsByDebtId.get(debt.id) ?? 0,
			}),
		};
	});

	const pendingRepairs = normalizedDebts.filter((debt, index) => {
		const previous = debts[index];
		return previous && Math.abs(Number(previous.currentBalance ?? 0) - Number(debt.currentBalance ?? 0)) > 0.009;
	});

	if (pendingRepairs.length) {
		await Promise.all(
			pendingRepairs.map((debt) =>
				prisma.debt.update({
					where: { id: debt.id },
					data: { currentBalance: String(Number(debt.currentBalance ?? 0)) },
				})
			)
		);
	}

	return normalizedDebts;
}

type DebtRow = {
	id: string;
	name: string;
	logoUrl: string | null;
	type: string;
	creditLimit: unknown | null;
	dueDay: number | null;
	dueDate: Date | string | null;
	initialBalance: unknown;
	currentBalance: unknown;
	amount: unknown;
	paid: boolean;
	paidAmount: unknown;
	defaultPaymentSource: unknown | null;
	defaultPaymentCardDebtId: string | null;
	monthlyMinimum: unknown | null;
	interestRate: unknown | null;
	installmentMonths: number | null;
	createdAt: Date | string;
	sourceType: string | null;
	sourceExpenseId: string | null;
	sourceMonthKey: string | null;
	sourceCategoryId: string | null;
	sourceCategoryName: string | null;
	sourceExpenseName: string | null;
};

async function getDebtsRaw(budgetPlanId: string, id?: string): Promise<DebtItem[]> {
	const rows = await prisma.$queryRaw<DebtRow[]>`
		SELECT
			"id",
			"name",
			"logoUrl",
			"type"::text AS "type",
			"creditLimit",
			"dueDay",
			"dueDate",
			"initialBalance",
			"currentBalance",
			"amount",
			"paid",
			"paidAmount",
			"defaultPaymentSource"::text AS "defaultPaymentSource",
			"defaultPaymentCardDebtId",
			"monthlyMinimum",
			"interestRate",
			"installmentMonths",
			"createdAt",
			"sourceType",
			"sourceExpenseId",
			"sourceMonthKey",
			"sourceCategoryId",
			"sourceCategoryName",
			"sourceExpenseName"
		FROM "Debt"
		WHERE "budgetPlanId" = ${budgetPlanId}
			AND (${id ?? null}::text IS NULL OR "id" = ${id ?? null})
		ORDER BY "createdAt" ASC
	`;
	return normalizeDebtBalances(rows.map(serializeDebt));
}

export async function getAllDebts(budgetPlanId: string): Promise<DebtItem[]> {
	try {
		const rows = await prisma.debt.findMany({
			where: { budgetPlanId },
			orderBy: [{ createdAt: "asc" }],
			select: debtSelect(),
		});
		return normalizeDebtBalances(rows.map(serializeDebt));
	} catch (error) {
		if (isDebtTypeEnumMismatchError(error)) return getDebtsRaw(budgetPlanId);
		throw error;
	}
}

export async function getDebtById(budgetPlanId: string, id: string): Promise<DebtItem | undefined> {
	try {
		const row = await prisma.debt.findFirst({ where: { id, budgetPlanId }, select: debtSelect() });
		if (!row) return undefined;
		const [debt] = await normalizeDebtBalances([serializeDebt(row)]);
		return debt;
	} catch (error) {
		if (isDebtTypeEnumMismatchError(error)) {
			const rows = await getDebtsRaw(budgetPlanId, id);
			return rows[0];
		}
		throw error;
	}
}

export async function getPaymentsByDebt(budgetPlanId: string, debtId: string): Promise<DebtPayment[]> {
	const debt = await prisma.debt.findFirst({ where: { id: debtId, budgetPlanId }, select: { id: true } });
	if (!debt) return [];
	const rows = await prisma.debtPayment.findMany({
		where: { debtId: debt.id },
		orderBy: [{ paidAt: "asc" }],
		select: paymentSelect(),
	});
	return rows.map(serializePayment);
}

export async function getPaymentsByMonth(
	budgetPlanId: string,
	month: string,
	yearOverride?: number,
	periodKey?: string
): Promise<DebtPayment[]> {
	const monthKey = month as MonthKey;
	const year = yearOverride ?? (await resolveBudgetYear(budgetPlanId));
	const monthNum = monthKeyToNumber(monthKey);
	// Prefer periodKey when available; fall back to year/month columns.
	const dateFilter = periodKey
		? { periodKey }
		: { year, month: monthNum };
	const rows = await prisma.debtPayment.findMany({
		where: {
			debt: { budgetPlanId },
			...dateFilter,
			source: "income",
		},
		orderBy: [{ paidAt: "asc" }],
		select: paymentSelect(),
	});
	return rows.map(serializePayment);
}

export async function getTotalDebtBalance(budgetPlanId: string): Promise<number> {
	const debts = await getAllDebts(budgetPlanId);
	return debts.reduce((sum, debt) => sum + decimalToNumber(debt.currentBalance), 0);
}
