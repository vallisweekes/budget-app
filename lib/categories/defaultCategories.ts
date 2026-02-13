import rawDefaultCategories from "@/data/categories.json";
import { prisma } from "@/lib/prisma";

export type DefaultCategorySeed = {
	name: string;
	icon?: string | null;
	color?: string | null;
	featured?: boolean;
};

const PERSONAL_ONLY_CATEGORIES: DefaultCategorySeed[] = [
	{ name: "Fees & Charges", icon: "Receipt", color: "slate", featured: false },
];

const CURRENT_CATEGORY_SEED_VERSION = 1;

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = rawDefaultCategories.map((c) => ({
	name: c.name,
	icon: c.icon ?? null,
	color: c.color ?? null,
	featured: Boolean(c.featured),
}));

function isPrismaValidationError(err: unknown, contains: string): boolean {
	if (!err || typeof err !== "object") return false;
	const maybe = err as { name?: unknown; message?: unknown };
	return (
		maybe.name === "PrismaClientValidationError" &&
		typeof maybe.message === "string" &&
		maybe.message.includes(contains)
	);
}

export async function ensureDefaultCategoriesForBudgetPlan(params: { budgetPlanId: string }) {
	const { budgetPlanId } = params;

	let plan: { kind: string; categorySeedVersion?: number } | null = null;
	try {
		plan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { kind: true, categorySeedVersion: true },
		});
	} catch (err) {
		// When running with a stale Prisma Client (e.g. dev server not restarted after migration),
		// selecting the new field will throw. Fall back to a safe, non-versioned path.
		if (!isPrismaValidationError(err, "categorySeedVersion")) {
			throw err;
		}

		const legacyPlan = await prisma.budgetPlan.findUnique({
			where: { id: budgetPlanId },
			select: { kind: true },
		});
		if (!legacyPlan) return;

		const existingCount = await prisma.category.count({ where: { budgetPlanId } });
		if (existingCount === 0) {
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

		if (legacyPlan.kind === "personal") {
			await prisma.category.createMany({
				data: PERSONAL_ONLY_CATEGORIES.map((c) => ({
					budgetPlanId,
					name: c.name,
					icon: c.icon ?? null,
					color: c.color ?? null,
					featured: Boolean(c.featured),
				})),
				skipDuplicates: true,
			});
		}

		return;
	}

	if (!plan) return;
	if ((plan.categorySeedVersion ?? 0) >= CURRENT_CATEGORY_SEED_VERSION) return;

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

	if (plan.kind === "personal") {
		await prisma.category.createMany({
			data: PERSONAL_ONLY_CATEGORIES.map((c) => ({
				budgetPlanId,
				name: c.name,
				icon: c.icon ?? null,
				color: c.color ?? null,
				featured: Boolean(c.featured),
			})),
			skipDuplicates: true,
		});
	}

	try {
		await prisma.budgetPlan.update({
			where: { id: budgetPlanId },
			data: { categorySeedVersion: CURRENT_CATEGORY_SEED_VERSION },
		});
	} catch (err) {
		if (!isPrismaValidationError(err, "categorySeedVersion")) {
			throw err;
		}
		// Ignore in legacy client mode.
	}
}
