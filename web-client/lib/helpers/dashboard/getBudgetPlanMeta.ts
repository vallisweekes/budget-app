import { prisma } from "@/lib/prisma";

export async function getBudgetPlanMeta(budgetPlanId: string): Promise<{
	payDate: number;
	homepageGoalIds: string[];
	createdAt: Date | null;
}> {
	let payDate = 1;
	let homepageGoalIds: string[] = [];
	let createdAt: Date | null = null;

	try {
		const planMeta = (await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			// prisma generate sometimes lags in editor type acquisition; keep runtime behavior correct.
			select: { payDate: true, homepageGoalIds: true, createdAt: true } as any,
		})) as unknown as { payDate?: unknown; homepageGoalIds?: unknown; createdAt?: unknown } | null;

		payDate = Number(planMeta?.payDate ?? 1);
		const rawHomepageGoalIds = planMeta?.homepageGoalIds;
		homepageGoalIds = Array.isArray(rawHomepageGoalIds)
			? rawHomepageGoalIds.filter((v: unknown): v is string => typeof v === "string")
			: [];
		createdAt = planMeta?.createdAt instanceof Date ? planMeta.createdAt : null;
	} catch {
		const planMeta = (await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { payDate: true, createdAt: true },
		})) as unknown as { payDate?: unknown; createdAt?: unknown } | null;
		payDate = Number(planMeta?.payDate ?? 1);
		createdAt = planMeta?.createdAt instanceof Date ? planMeta.createdAt : null;
		homepageGoalIds = [];
	}

	return { payDate, homepageGoalIds, createdAt };
}
