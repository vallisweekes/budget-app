import type { DebtItem, DebtPayment, MonthKey } from "@/types";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import { prisma } from "@/lib/prisma";
import {
	debtSelect,
	paymentSelect,
	decimalToNumber,
} from "./shared";
import {
	serializeDebt,
	serializePayment,
	isDebtTypeEnumMismatchError,
	resolveBudgetYear,
} from "./transforms";

type DebtRow = {
	id: string;
	name: string;
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
	return rows.map(serializeDebt);
}

export async function getAllDebts(budgetPlanId: string): Promise<DebtItem[]> {
	try {
		const rows = await prisma.debt.findMany({
			where: { budgetPlanId },
			orderBy: [{ createdAt: "asc" }],
			select: debtSelect(),
		});
		return rows.map(serializeDebt);
	} catch (error) {
		if (isDebtTypeEnumMismatchError(error)) return getDebtsRaw(budgetPlanId);
		throw error;
	}
}

export async function getDebtById(budgetPlanId: string, id: string): Promise<DebtItem | undefined> {
	try {
		const row = await prisma.debt.findFirst({ where: { id, budgetPlanId }, select: debtSelect() });
		return row ? serializeDebt(row) : undefined;
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
	yearOverride?: number
): Promise<DebtPayment[]> {
	const monthKey = month as MonthKey;
	const year = yearOverride ?? (await resolveBudgetYear(budgetPlanId));
	const monthNum = monthKeyToNumber(monthKey);
	const rows = await prisma.debtPayment.findMany({
		where: {
			debt: { budgetPlanId },
			year,
			month: monthNum,
			source: "income",
		},
		orderBy: [{ paidAt: "asc" }],
		select: paymentSelect(),
	});
	return rows.map(serializePayment);
}

export async function getTotalDebtBalance(budgetPlanId: string): Promise<number> {
	const rows = await prisma.debt.findMany({ where: { budgetPlanId }, select: { currentBalance: true } });
	return rows.reduce((sum, debt) => sum + decimalToNumber(debt.currentBalance), 0);
}
