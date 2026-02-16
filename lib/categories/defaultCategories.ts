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

// Bump this when default categories change in a way that should be treated as a one-time backfill.
// Note: we *also* run a lightweight missing-defaults check on every call so users don't drift
// out of sync when we add new defaults.
const CURRENT_CATEGORY_SEED_VERSION = 2;

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

	const syncDefaults = async (planKind: string) => {
		const desired = planKind === "personal" ? [...DEFAULT_CATEGORIES, ...PERSONAL_ONLY_CATEGORIES] : DEFAULT_CATEGORIES;
		const desiredByName = new Map(desired.map((c) => [c.name, c] as const));
		const desiredNames = [...desiredByName.keys()];

		// Only check defaults (not user-created categories) so this stays fast.
		const existingDefaults = await prisma.category.findMany({
			where: { budgetPlanId, name: { in: desiredNames } },
			select: { id: true, name: true, icon: true, color: true, featured: true },
		});
		const existingByName = new Map(existingDefaults.map((c) => [c.name, c] as const));

		const missing = desiredNames.filter((name) => !existingByName.has(name));
		if (missing.length > 0) {
			await prisma.category.createMany({
				data: missing.map((name) => {
					const c = desiredByName.get(name)!;
					return {
						budgetPlanId,
						name: c.name,
						icon: c.icon ?? null,
						color: c.color ?? null,
						featured: Boolean(c.featured),
					};
				}),
				skipDuplicates: true,
			});
		}

		// Patch only missing fields from defaults (keeps user customizations intact).
		const patchUpdates = existingDefaults
			.map((row) => {
				const def = desiredByName.get(row.name);
				if (!def) return null;
				const nextIcon = row.icon ?? def.icon ?? null;
				const nextColor = row.color ?? def.color ?? null;
				const nextFeatured = row.featured || Boolean(def.featured);
				const needsUpdate = nextIcon !== row.icon || nextColor !== row.color || nextFeatured !== row.featured;
				if (!needsUpdate) return null;
				return prisma.category.update({
					where: { id: row.id },
					data: { icon: nextIcon, color: nextColor, featured: nextFeatured },
				});
			})
			.filter(Boolean) as Array<ReturnType<typeof prisma.category.update>>;
		if (patchUpdates.length > 0) {
			await Promise.all(patchUpdates);
		}
	};

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

		await syncDefaults(legacyPlan.kind);

		return;
	}

	if (!plan) return;

	// Always ensure missing defaults exist so users don't drift out of sync.
	await syncDefaults(plan.kind);

	try {
		if ((plan.categorySeedVersion ?? 0) < CURRENT_CATEGORY_SEED_VERSION) {
			await prisma.budgetPlan.update({
				where: { id: budgetPlanId },
				data: { categorySeedVersion: CURRENT_CATEGORY_SEED_VERSION },
			});
		}
	} catch (err) {
		if (!isPrismaValidationError(err, "categorySeedVersion")) {
			throw err;
		}
		// Ignore in legacy client mode.
	}
}
