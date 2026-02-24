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
	if (planIds.length === 0) return {};
	const perPlanLimit = Math.max(1, Math.min(6, Math.floor(params.perPlanLimit ?? 3)));

	const nowYear = now.getFullYear();
	const nowMonth = now.getMonth() + 1; // 1-12

	const out: Record<string, LargestExpensesForPlan> = {};
	const rows = await prisma.expense.findMany({
		where: {
			budgetPlanId: { in: planIds },
			amount: { gt: 0 },
		},
		select: {
			id: true,
			name: true,
			amount: true,
			year: true,
			month: true,
			budgetPlanId: true,
		},
		orderBy: [{ budgetPlanId: "asc" }, { year: "asc" }, { month: "asc" }, { amount: "desc" }],
	});

	const rowsByPlan = new Map<string, typeof rows>();
	for (const row of rows) {
		const existing = rowsByPlan.get(row.budgetPlanId);
		if (existing) {
			existing.push(row);
		} else {
			rowsByPlan.set(row.budgetPlanId, [row]);
		}
	}

	for (const planId of planIds) {
		const planRows = rowsByPlan.get(planId) ?? [];
		if (planRows.length === 0) continue;

		const futureOrCurrent = planRows.find(
			(r) => r.year > nowYear || (r.year === nowYear && r.month >= nowMonth)
		);
		const target = futureOrCurrent ?? planRows[planRows.length - 1];

		const items = planRows
			.filter((r) => r.year === target.year && r.month === target.month)
			.sort((a, b) => toNumberAmount(b.amount) - toNumberAmount(a.amount))
			.slice(0, perPlanLimit)
			.map((e) => ({
				id: e.id,
				name: e.name,
				amount: toNumberAmount(e.amount),
			}));

		out[planId] = {
			year: target.year,
			month: target.month,
			items,
		};
	}
	return out;
}
