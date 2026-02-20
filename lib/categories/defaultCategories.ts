import rawDefaultCategories from "@/data/categories.json";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";

export type DefaultCategorySeed = {
	name: string;
	icon?: string | null;
	color?: string | null;
	featured?: boolean;
};

// Fallback defaults (used only if DB templates are unavailable at runtime).
const FALLBACK_BASE_CATEGORIES: DefaultCategorySeed[] = rawDefaultCategories.map((c) => ({
	name: c.name,
	icon: c.icon ?? null,
	color: c.color ?? null,
	featured: Boolean(c.featured),
}));

const FALLBACK_PERSONAL_ONLY_CATEGORIES: DefaultCategorySeed[] = [
	{ name: "Fees & Charges", icon: "Receipt", color: "slate", featured: false },
];

const FALLBACK_CARNIVAL_ONLY_CATEGORIES: DefaultCategorySeed[] = [
	{ name: "Costumes", icon: "Shirt", color: "pink", featured: true },
	{ name: "Events Tickets", icon: "Ticket", color: "amber", featured: true },
	{ name: "Jouvert Package", icon: "Package", color: "violet", featured: true },
	{ name: "Transport", icon: "Car", color: "sky", featured: false },
	{ name: "Accommodation", icon: "Home", color: "emerald", featured: false },
	{ name: "Flights", icon: "Plane", color: "cyan", featured: false },
	{ name: "Spending Money", icon: "Wallet", color: "slate", featured: false },
	{ name: "Drinks and Food", icon: "Utensils", color: "orange", featured: false },
	{ name: "Rental", icon: "Key", color: "indigo", featured: false },
	{ name: "Other", icon: "DotsHorizontal", color: "slate", featured: false },
];

const FALLBACK_HOLIDAY_ONLY_CATEGORIES: DefaultCategorySeed[] = [
	{ name: "Activities", icon: "Sparkles", color: "pink", featured: true },
	{ name: "Tours", icon: "Map", color: "amber", featured: true },
	{ name: "Spending Money", icon: "Wallet", color: "slate", featured: false },
	{ name: "Accommodation", icon: "Home", color: "emerald", featured: false },
	{ name: "Flights", icon: "Plane", color: "cyan", featured: false },
	{ name: "Rental", icon: "Key", color: "indigo", featured: false },
];

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
		const fallbackDesired =
			planKind === "personal"
				? [...FALLBACK_BASE_CATEGORIES, ...FALLBACK_PERSONAL_ONLY_CATEGORIES]
				: planKind === "carnival"
					? [...FALLBACK_BASE_CATEGORIES, ...FALLBACK_CARNIVAL_ONLY_CATEGORIES]
					: planKind === "holiday"
						? [...FALLBACK_BASE_CATEGORIES, ...FALLBACK_HOLIDAY_ONLY_CATEGORIES]
						: FALLBACK_BASE_CATEGORIES;

		let desired: DefaultCategorySeed[] = [];
		const categoryTemplateDelegate = (prisma as any)?.categoryTemplate;
		const canUseTemplates =
			categoryTemplateDelegate && typeof categoryTemplateDelegate.findMany === "function";

		if (canUseTemplates) {
			try {
				type TemplateRow = { name: string; icon: string | null; color: string | null; featured: boolean };
				const templates = (await categoryTemplateDelegate.findMany({
					where: {
						isActive: true,
						kindKey: { in: ["base", planKind] },
					},
					select: { name: true, icon: true, color: true, featured: true },
					orderBy: [{ kindKey: "asc" }, { sortOrder: "asc" }],
				})) as TemplateRow[];

				desired = templates.map((t) => ({
					name: t.name,
					icon: t.icon ?? null,
					color: t.color ?? null,
					featured: Boolean(t.featured),
				}));
			} catch {
				desired = [];
			}
		}

		// If templates aren't available yet (stale Prisma client / migration not applied / no rows),
		// fall back so the app can still run.
		if (desired.length === 0) {
			desired = fallbackDesired;
		}
		if (desired.length === 0) return;
		const desiredByName = new Map(desired.map((c) => [c.name, c] as const));
		const desiredNames = [...desiredByName.keys()];

		// Only check defaults (not user-created categories) so this stays fast.
		const existingDefaults = await withPrismaRetry(
			() =>
				prisma.category.findMany({
					where: { budgetPlanId, name: { in: desiredNames } },
					select: { id: true, name: true, icon: true, color: true, featured: true },
				}),
			{ retries: 2, delayMs: 150 }
		);
		const existingByName = new Map(existingDefaults.map((c) => [c.name, c] as const));

		const missing = desiredNames.filter((name) => !existingByName.has(name));
		if (missing.length > 0) {
			await withPrismaRetry(
				() =>
					prisma.category.createMany({
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
					}),
				{ retries: 2, delayMs: 150 }
			);
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
				return withPrismaRetry(
					() =>
						prisma.category.update({
							where: { id: row.id },
							data: { icon: nextIcon, color: nextColor, featured: nextFeatured },
						}),
					{ retries: 2, delayMs: 150 }
				);
			})
			.filter(Boolean) as Array<ReturnType<typeof prisma.category.update>>;
		if (patchUpdates.length > 0) {
			await Promise.all(patchUpdates);
		}
	};

	let plan: { kind: string; categorySeedVersion?: number } | null = null;
	try {
		plan = await withPrismaRetry(
			() =>
				prisma.budgetPlan.findUnique({
					where: { id: budgetPlanId },
					select: { kind: true, categorySeedVersion: true },
				}),
			{ retries: 2, delayMs: 150 }
		);
	} catch (err) {
		// When running with a stale Prisma Client (e.g. dev server not restarted after migration),
		// selecting the new field will throw. Fall back to a safe, non-versioned path.
		if (!isPrismaValidationError(err, "categorySeedVersion")) {
			throw err;
		}

		const legacyPlan = await withPrismaRetry(
			() =>
				prisma.budgetPlan.findUnique({
					where: { id: budgetPlanId },
					select: { kind: true },
				}),
			{ retries: 2, delayMs: 150 }
		);
		if (!legacyPlan) return;

		await syncDefaults(legacyPlan.kind);

		return;
	}

	if (!plan) return;

	// Always ensure missing defaults exist so users don't drift out of sync.
	await syncDefaults(plan.kind);

	// NOTE: categorySeedVersion is kept for backwards compatibility but is no longer required.
}
