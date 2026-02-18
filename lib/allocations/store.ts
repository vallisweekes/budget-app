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

export type CustomAllocationItem = {
	id: string;
	name: string;
	amount: number;
	isOverride: boolean;
};

export type MonthlyCustomAllocationsSnapshot = {
	year: number;
	month: number;
	items: CustomAllocationItem[];
	total: number;
};

export type ContributionTotalsToDate = {
	year: number;
	throughMonth: number;
	savings: number;
	emergency: number;
	investment: number;
	allowance: number;
};

function warnStalePrismaClient(feature: string) {
	if (process.env.NODE_ENV === "production") return;
	// Dev-only safety: after Prisma schema changes, Next dev server sometimes holds a stale client instance.
	// This prevents hard crashes and hints at the fix.
	console.warn(`[allocations] ${feature} unavailable (stale Prisma Client). Restart the dev server to pick up schema changes.`);
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "object" && value !== null && "toString" in value) {
		const asString = String((value as { toString: () => string }).toString());
		return Number(asString);
	}
	return Number(String(value));
}

function normalizeAllocationName(name: string): string {
	return String(name ?? "").trim();
}

export async function getContributionTotalsToDate(
	budgetPlanId: string,
	options?: { year?: number; throughMonth?: number }
): Promise<ContributionTotalsToDate> {
	const year = options?.year ?? (await resolveActiveBudgetYear(budgetPlanId));

	const now = new Date();
	const defaultThroughMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
	const throughMonthRaw = options?.throughMonth ?? defaultThroughMonth;
	const throughMonth = Math.max(1, Math.min(12, Math.floor(throughMonthRaw)));

	let plan: any = null;
	try {
		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				monthlyAllowance: true,
				monthlySavingsContribution: true,
				monthlyEmergencyContribution: true,
				monthlyInvestmentContribution: true,
			} as any,
		});
	} catch (error) {
		const message = String((error as any)?.message ?? error);
		if (!message.includes("Unknown field `monthlyEmergencyContribution`")) throw error;

		// Dev-only safety: Turbopack can cache an older Prisma Client after schema changes.
		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				monthlyAllowance: true,
				monthlySavingsContribution: true,
				monthlyInvestmentContribution: true,
			} as any,
		});
	}

	if (!plan) throw new Error(`Budget plan ${budgetPlanId} not found`);

	const baseAllowance = decimalToNumber(plan.monthlyAllowance);
	const baseSavings = decimalToNumber(plan.monthlySavingsContribution);
	const baseEmergency = decimalToNumber((plan as any).monthlyEmergencyContribution ?? 0);
	const baseInvestment = decimalToNumber(plan.monthlyInvestmentContribution);

	type MonthlyAllocationFindManyDelegate = {
		findMany: (args: {
			where: any;
			select: {
				month: true;
				monthlyAllowance: true;
				monthlySavingsContribution: true;
				monthlyEmergencyContribution: true;
				monthlyInvestmentContribution: true;
			};
		}) => Promise<
			Array<{
				month: number;
				monthlyAllowance: unknown;
				monthlySavingsContribution: unknown;
				monthlyEmergencyContribution: unknown;
				monthlyInvestmentContribution: unknown;
			}>
		>;
	};

	const monthlyAllocation = (prisma as unknown as { monthlyAllocation?: MonthlyAllocationFindManyDelegate }).monthlyAllocation;
	let overridesByMonth = new Map<number, {
		allowance: number;
		savings: number;
		emergency: number;
		investment: number;
	}>();

	if (monthlyAllocation?.findMany) {
		const rows = await monthlyAllocation.findMany({
			where: {
				budgetPlanId,
				year,
				month: { lte: throughMonth },
			},
			select: {
				month: true,
				monthlyAllowance: true,
				monthlySavingsContribution: true,
				monthlyEmergencyContribution: true,
				monthlyInvestmentContribution: true,
			} as any,
		});

		overridesByMonth = new Map(
			rows.map((row) => [
				row.month,
				{
					allowance: decimalToNumber(row.monthlyAllowance),
					savings: decimalToNumber(row.monthlySavingsContribution),
					emergency: decimalToNumber(row.monthlyEmergencyContribution),
					investment: decimalToNumber(row.monthlyInvestmentContribution),
				},
			])
		);
	} else {
		warnStalePrismaClient("monthlyAllocation.findMany");
	}

	let allowance = 0;
	let savings = 0;
	let emergency = 0;
	let investment = 0;

	for (let month = 1; month <= throughMonth; month += 1) {
		const override = overridesByMonth.get(month);
		allowance += override?.allowance ?? baseAllowance;
		savings += override?.savings ?? baseSavings;
		emergency += override?.emergency ?? baseEmergency;
		investment += override?.investment ?? baseInvestment;
	}

	return { year, throughMonth, allowance, savings, emergency, investment };
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
	let plan: any = null;
	try {
		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				monthlyAllowance: true,
				monthlySavingsContribution: true,
				monthlyEmergencyContribution: true,
				monthlyInvestmentContribution: true,
			} as any,
		});
	} catch (error) {
		const message = String((error as any)?.message ?? error);
		if (!message.includes("Unknown field `monthlyEmergencyContribution`")) throw error;

		// Dev-only safety: Turbopack can cache an older Prisma Client after schema changes.
		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: {
				monthlyAllowance: true,
				monthlySavingsContribution: true,
				monthlyInvestmentContribution: true,
			} as any,
		});
	}

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
		override?.monthlyEmergencyContribution ?? (plan as any).monthlyEmergencyContribution ?? 0
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

export async function listAllocationDefinitions(budgetPlanId: string): Promise<
	Array<{ id: string; name: string; defaultAmount: number; sortOrder: number; isArchived: boolean }>
> {
	const allocationDefinition = (prisma as unknown as { allocationDefinition?: any }).allocationDefinition;
	if (!allocationDefinition?.findMany) {
		throw new Error(
			"Custom allocations are not available yet. Restart the dev server to pick up Prisma schema changes."
		);
	}

	type AllocationDefinitionListRow = {
		id: string;
		name: string;
		defaultAmount: unknown;
		sortOrder: number;
		isArchived: boolean;
	};

	const defs = (await allocationDefinition.findMany({
		where: { budgetPlanId },
		orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
		select: { id: true, name: true, defaultAmount: true, sortOrder: true, isArchived: true },
	})) as AllocationDefinitionListRow[];

	return defs.map((d) => ({
		id: d.id,
		name: d.name,
		defaultAmount: decimalToNumber(d.defaultAmount),
		sortOrder: d.sortOrder,
		isArchived: d.isArchived,
	}));
}

export async function createAllocationDefinition(params: {
	budgetPlanId: string;
	name: string;
	defaultAmount?: number;
}): Promise<{ id: string; name: string; defaultAmount: number; sortOrder: number }> {
	const name = normalizeAllocationName(params.name);
	if (!name) throw new Error("Allocation name is required");

	const allocationDefinition = (prisma as unknown as { allocationDefinition?: any }).allocationDefinition;
	if (!allocationDefinition?.aggregate || !allocationDefinition?.create) {
		throw new Error(
			"Custom allocations are not available yet. Restart the dev server to pick up Prisma schema changes."
		);
	}

	const maxSort = await allocationDefinition.aggregate({
		where: { budgetPlanId: params.budgetPlanId },
		_max: { sortOrder: true },
	});
	const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
	const defaultAmount = Number(params.defaultAmount ?? 0);

	type AllocationDefinitionCreateRow = { id: string; name: string; defaultAmount: unknown; sortOrder: number };

	const created = (await allocationDefinition.create({
		data: {
			budgetPlanId: params.budgetPlanId,
			name,
			defaultAmount,
			sortOrder,
		},
		select: { id: true, name: true, defaultAmount: true, sortOrder: true },
	})) as AllocationDefinitionCreateRow;

	return {
		id: created.id,
		name: created.name,
		defaultAmount: decimalToNumber(created.defaultAmount),
		sortOrder: created.sortOrder,
	};
}

export async function getMonthlyCustomAllocationsSnapshot(
	budgetPlanId: string,
	monthKey: MonthKey,
	options?: { year?: number }
): Promise<MonthlyCustomAllocationsSnapshot> {
	const year = options?.year ?? (await resolveActiveBudgetYear(budgetPlanId));
	const month = monthKeyToNumber(monthKey);

	const allocationDefinition = (prisma as unknown as { allocationDefinition?: any }).allocationDefinition;
	const monthlyAllocationItem = (prisma as unknown as { monthlyAllocationItem?: any }).monthlyAllocationItem;
	if (!allocationDefinition?.findMany || !monthlyAllocationItem?.findMany) {
		warnStalePrismaClient("Custom allocations");
		return { year, month, items: [], total: 0 };
	}

	type AllocationDefinitionSnapshotRow = { id: string; name: string; defaultAmount: unknown };
	type MonthlyAllocationItemRow = { allocationId: string; amount: unknown };

	const [defs, overrides] = (await Promise.all([
		allocationDefinition.findMany({
			where: { budgetPlanId, isArchived: false },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: { id: true, name: true, defaultAmount: true },
		}),
		monthlyAllocationItem.findMany({
			where: { budgetPlanId, year, month },
			select: { allocationId: true, amount: true },
		}),
	])) as [AllocationDefinitionSnapshotRow[], MonthlyAllocationItemRow[]];

	const overrideById = new Map<string, number>();
	for (const row of overrides) {
		overrideById.set(row.allocationId, decimalToNumber(row.amount));
	}

	const items: CustomAllocationItem[] = defs.map((d: AllocationDefinitionSnapshotRow) => {
		const defaultAmount = decimalToNumber(d.defaultAmount);
		const override = overrideById.get(d.id);
		return {
			id: d.id,
			name: d.name,
			amount: typeof override === "number" ? override : defaultAmount,
			isOverride: typeof override === "number",
		};
	});

	const total = items.reduce((sum, it) => sum + (it.amount ?? 0), 0);

	return { year, month, items, total };
}

export async function upsertMonthlyCustomAllocationOverrides(params: {
	budgetPlanId: string;
	year: number;
	month: number;
	amountsByAllocationId: Record<string, number>;
}): Promise<void> {
	const allocationIds = Object.keys(params.amountsByAllocationId);
	if (allocationIds.length === 0) return;

	const allocationDefinition = (prisma as unknown as { allocationDefinition?: any }).allocationDefinition;
	const monthlyAllocationItem = (prisma as unknown as { monthlyAllocationItem?: any }).monthlyAllocationItem;
	if (!allocationDefinition?.findMany || !monthlyAllocationItem?.deleteMany || !monthlyAllocationItem?.upsert) {
		throw new Error(
			"Custom allocations are not available yet. Restart the dev server to pick up Prisma schema changes."
		);
	}

	type AllocationDefinitionDefaultsRow = { id: string; defaultAmount: unknown };
	const defs = (await allocationDefinition.findMany({
		where: { budgetPlanId: params.budgetPlanId, id: { in: allocationIds }, isArchived: false },
		select: { id: true, defaultAmount: true },
	})) as AllocationDefinitionDefaultsRow[];
	const defaultById = new Map(defs.map((d) => [d.id, decimalToNumber(d.defaultAmount)] as const));

	for (const allocationId of allocationIds) {
		const raw = params.amountsByAllocationId[allocationId];
		const amount = Number.isFinite(raw) ? Number(raw) : 0;
		const defaultAmount = defaultById.get(allocationId);
		if (typeof defaultAmount !== "number") continue;

		// If user sets it back to the default, remove the override row.
		if (amount === defaultAmount) {
			await monthlyAllocationItem.deleteMany({
				where: { allocationId, year: params.year, month: params.month },
			});
			continue;
		}

		await monthlyAllocationItem.upsert({
			where: { allocationId_year_month: { allocationId, year: params.year, month: params.month } },
			create: {
				budgetPlanId: params.budgetPlanId,
				allocationId,
				year: params.year,
				month: params.month,
				amount,
			},
			update: { amount },
		});
	}
}

export async function removeMonthlyAllocationOverride(params: {
	budgetPlanId: string;
	year: number;
	month: number;
}): Promise<void> {
	type MonthlyAllocationDeleteManyDelegate = {
		deleteMany: (args: { where: { budgetPlanId: string; year: number; month: number } }) => Promise<unknown>;
	};

	const monthlyAllocation = (prisma as unknown as { monthlyAllocation?: MonthlyAllocationDeleteManyDelegate }).monthlyAllocation;
	if (!monthlyAllocation?.deleteMany) {
		throw new Error(
			"Monthly allocations are not available yet. Restart the dev server to pick up Prisma schema changes."
		);
	}

	await monthlyAllocation.deleteMany({
		where: { budgetPlanId: params.budgetPlanId, year: params.year, month: params.month },
	});
}

export async function removeAllMonthlyCustomAllocationOverrides(params: {
	budgetPlanId: string;
	year: number;
	month: number;
}): Promise<void> {
	const monthlyAllocationItem = (prisma as unknown as { monthlyAllocationItem?: any }).monthlyAllocationItem;
	if (!monthlyAllocationItem?.deleteMany) {
		throw new Error(
			"Custom allocations are not available yet. Restart the dev server to pick up Prisma schema changes."
		);
	}

	await monthlyAllocationItem.deleteMany({
		where: { budgetPlanId: params.budgetPlanId, year: params.year, month: params.month },
	});
}
