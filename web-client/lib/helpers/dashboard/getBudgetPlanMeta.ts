import { prisma } from "@/lib/prisma";

export async function getBudgetPlanMeta(budgetPlanId: string): Promise<{
	payDate: number;
	homepageGoalIds: string[];
}> {
	let payDate = 1;
	let homepageGoalIds: string[] = [];

	try {
		const planMeta = (await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			// prisma generate sometimes lags in editor type acquisition; keep runtime behavior correct.
			select: { payDate: true, homepageGoalIds: true } as any,
		})) as unknown as { payDate?: unknown; homepageGoalIds?: unknown } | null;

		payDate = Number(planMeta?.payDate ?? 1);
		const rawHomepageGoalIds = planMeta?.homepageGoalIds;
		homepageGoalIds = Array.isArray(rawHomepageGoalIds)
			? rawHomepageGoalIds.filter((v: unknown): v is string => typeof v === "string")
			: [];
	} catch {
		const planMeta = (await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { payDate: true },
		})) as unknown as { payDate?: unknown } | null;
		payDate = Number(planMeta?.payDate ?? 1);
		homepageGoalIds = [];
	}

	return { payDate, homepageGoalIds };
}
