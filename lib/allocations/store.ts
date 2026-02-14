import { prisma } from "@/lib/prisma";
import { monthKeyToNumber } from "@/lib/helpers/monthKey";
import type { MonthKey } from "@/types";

export type MonthlyAllocationSnapshot = {
	year: number;
	month: number;
	monthlyAllowance: number;
	monthlySavingsContribution: number;
	monthlyEmergencyContribution: number;
	monthlyInvestmentContribution: number;
	isOverride: boolean;
};

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "object" && value !== null && "toString" in value) {
		const asString = String((value as { toString: () => string }).toString());
		return Number(asString);
	}
	return Number(String(value));
}

export async function resolveActiveBudgetYear(budgetPlanId: string): Promise<number> {
	// Avoid parallel queries here to reduce connection pool pressure in dev.
	const latestIncome = await prisma.income.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	if (latestIncome?.year) return latestIncome.year;

	const latestExpense = await prisma.expense.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});

	return latestExpense?.year ?? new Date().getFullYear();
}

export async function getMonthlyAllocationSnapshot(
	budgetPlanId: string,
	monthKey: MonthKey,
	options?: { year?: number }
): Promise<MonthlyAllocationSnapshot> {
	const year = options?.year ?? (await resolveActiveBudgetYear(budgetPlanId));
	const month = monthKeyToNumber(monthKey);

	type MonthlyAllocationDelegate = {
		findUnique: (args: {
			where: { budgetPlanId_year_month: { budgetPlanId: string; year: number; month: number } };
			select: {
				monthlyAllowance: true;
				monthlySavingsContribution: true;
				monthlyEmergencyContribution: true;
				monthlyInvestmentContribution: true;
			};
		}) => Promise<{
			monthlyAllowance: unknown;
			monthlySavingsContribution: unknown;
			monthlyEmergencyContribution: unknown;
			monthlyInvestmentContribution: unknown;
		} | null>;
	};

	const monthlyAllocation = (prisma as unknown as { monthlyAllocation?: MonthlyAllocationDelegate }).monthlyAllocation;

	// Avoid parallel queries here to reduce connection pool pressure in dev.
	const plan = ((await (prisma.budgetPlan.findUnique({
		where: { id: budgetPlanId },
		select: {
			monthlyAllowance: true,
			monthlySavingsContribution: true,
			monthlyEmergencyContribution: true,
			monthlyInvestmentContribution: true,
		} as any,
	}) as any)) as any) as any;

	const override = monthlyAllocation
		? await monthlyAllocation.findUnique({
				where: { budgetPlanId_year_month: { budgetPlanId, year, month } },
				select: {
					monthlyAllowance: true,
					monthlySavingsContribution: true,
					monthlyEmergencyContribution: true,
					monthlyInvestmentContribution: true,
				} as any,
			})
		: null;

	if (!plan) throw new Error(`Budget plan ${budgetPlanId} not found`);

	const monthlyAllowance = decimalToNumber(override?.monthlyAllowance ?? plan.monthlyAllowance);
	const monthlySavingsContribution = decimalToNumber(
		override?.monthlySavingsContribution ?? plan.monthlySavingsContribution
	);
	const monthlyEmergencyContribution = decimalToNumber(
		override?.monthlyEmergencyContribution ?? (plan as any).monthlyEmergencyContribution
	);
	const monthlyInvestmentContribution = decimalToNumber(
		override?.monthlyInvestmentContribution ?? plan.monthlyInvestmentContribution
	);

	return {
		year,
		month,
		monthlyAllowance,
		monthlySavingsContribution,
		monthlyEmergencyContribution,
		monthlyInvestmentContribution,
		isOverride: Boolean(override),
	};
}

export async function upsertMonthlyAllocation(
	budgetPlanId: string,
	year: number,
	month: number,
	values: {
		monthlyAllowance: number;
		monthlySavingsContribution: number;
		monthlyEmergencyContribution: number;
		monthlyInvestmentContribution: number;
	}
): Promise<void> {
	type MonthlyAllocationUpsertDelegate = {
		upsert: (args: {
			where: { budgetPlanId_year_month: { budgetPlanId: string; year: number; month: number } };
			create: {
				budgetPlanId: string;
				year: number;
				month: number;
				monthlyAllowance: number;
				monthlySavingsContribution: number;
				monthlyEmergencyContribution: number;
				monthlyInvestmentContribution: number;
			};
			update: {
				monthlyAllowance: number;
				monthlySavingsContribution: number;
				monthlyEmergencyContribution: number;
				monthlyInvestmentContribution: number;
			};
		}) => Promise<unknown>;
	};

	const monthlyAllocation = (prisma as unknown as { monthlyAllocation?: MonthlyAllocationUpsertDelegate }).monthlyAllocation;
	if (!monthlyAllocation) {
		// Dev-only safety: schema/client might be stale until Next dev server restarts.
		throw new Error("Monthly allocations are not available yet. Restart the dev server to pick up Prisma schema changes.");
	}

	await monthlyAllocation.upsert({
		where: { budgetPlanId_year_month: { budgetPlanId, year, month } },
		create: {
			budgetPlanId,
			year,
			month,
			monthlyAllowance: values.monthlyAllowance,
			monthlySavingsContribution: values.monthlySavingsContribution,
			monthlyEmergencyContribution: values.monthlyEmergencyContribution,
			monthlyInvestmentContribution: values.monthlyInvestmentContribution,
		},
		update: {
			monthlyAllowance: values.monthlyAllowance,
			monthlySavingsContribution: values.monthlySavingsContribution,
			monthlyEmergencyContribution: values.monthlyEmergencyContribution,
			monthlyInvestmentContribution: values.monthlyInvestmentContribution,
		},
	});
}
