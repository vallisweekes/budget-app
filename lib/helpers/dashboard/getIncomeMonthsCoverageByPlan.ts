import { prisma } from "@/lib/prisma";

export async function getIncomeMonthsCoverageByPlan({
	planIds,
	year,
}: {
	planIds: string[];
	year: number;
}): Promise<Record<string, number>> {
	const incomeMonthsCoverageByPlan: Record<string, number> = {};
	if (planIds.length === 0) return incomeMonthsCoverageByPlan;

	try {
		const groups = await prisma.income.groupBy({
			by: ["budgetPlanId", "month"],
			where: {
				budgetPlanId: { in: planIds },
				year,
			},
		});
		for (const g of groups) {
			incomeMonthsCoverageByPlan[g.budgetPlanId] = (incomeMonthsCoverageByPlan[g.budgetPlanId] ?? 0) + 1;
		}
	} catch {
		// Non-blocking
	}

	return incomeMonthsCoverageByPlan;
}
