import { prisma } from "@/lib/prisma";

export type LargestExpenseListItem = {
	id: string;
	name: string;
	amount: number;
};

export type LargestExpensesForPlan = {
	year: number;
	month: number;
	items: LargestExpenseListItem[];
};

function toNumberAmount(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

export async function getLargestExpensesByPlan(params: {
	planIds: string[];
	now: Date;
	perPlanLimit?: number;
}): Promise<Record<string, LargestExpensesForPlan>> {
	const { planIds, now } = params;
	const perPlanLimit = Math.max(1, Math.min(6, Math.floor(params.perPlanLimit ?? 3)));

	const nowYear = now.getFullYear();
	const nowMonth = now.getMonth() + 1; // 1-12

	const pairs = await Promise.all(
		planIds.map(async (budgetPlanId) => {
			// Find the earliest future (or current) month that has any expenses.
			const firstFuture = await prisma.expense.findFirst({
				where: {
					budgetPlanId,
					amount: { gt: 0 },
					OR: [{ year: { gt: nowYear } }, { year: nowYear, month: { gte: nowMonth } }],
				},
				select: { year: true, month: true },
				orderBy: [{ year: "asc" }, { month: "asc" }],
			});

			// If nothing exists in the future, fall back to the most recent past month.
			const target =
				firstFuture ??
				(await prisma.expense.findFirst({
					where: { budgetPlanId, amount: { gt: 0 } },
					select: { year: true, month: true },
					orderBy: [{ year: "desc" }, { month: "desc" }],
				}));

			if (!target) return [budgetPlanId, null] as const;

			const items = await prisma.expense.findMany({
				where: {
					budgetPlanId,
					year: target.year,
					month: target.month,
					amount: { gt: 0 },
				},
				select: { id: true, name: true, amount: true },
				orderBy: { amount: "desc" },
				take: perPlanLimit,
			});

			return [
				budgetPlanId,
				{
					year: target.year,
					month: target.month,
					items: items.map((e) => ({
						id: e.id,
						name: e.name,
						amount: toNumberAmount(e.amount),
					})),
				},
			] as const;
		})
	);

	const out: Record<string, LargestExpensesForPlan> = {};
	for (const [planId, data] of pairs) {
		if (data) out[planId] = data;
	}
	return out;
}
