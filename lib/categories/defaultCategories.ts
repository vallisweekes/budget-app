import rawDefaultCategories from "@/data/categories.json";
import { prisma } from "@/lib/prisma";

export type DefaultCategorySeed = {
	name: string;
	icon?: string | null;
	color?: string | null;
	featured?: boolean;
};

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = rawDefaultCategories.map((c) => ({
	name: c.name,
	icon: c.icon ?? null,
	color: c.color ?? null,
	featured: Boolean(c.featured),
}));

export async function ensureDefaultCategoriesForBudgetPlan(params: { budgetPlanId: string }) {
	const { budgetPlanId } = params;

	const existingCount = await prisma.category.count({ where: { budgetPlanId } });
	if (existingCount > 0) return;

	await prisma.category.createMany({
		data: DEFAULT_CATEGORIES.map((c) => ({
			budgetPlanId,
			name: c.name,
			icon: c.icon ?? null,
			color: c.color ?? null,
			featured: Boolean(c.featured),
		})),
		skipDuplicates: true,
	});
}
