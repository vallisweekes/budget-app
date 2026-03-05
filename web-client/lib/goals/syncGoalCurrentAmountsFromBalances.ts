import { prisma } from "@/lib/prisma";

type BalanceCategory = "savings" | "emergency" | "investment";

type Balances = Partial<Record<BalanceCategory, number>>;

function normalizeTitle(title: unknown): string {
	return String(title ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function pickGoalIdForCategory(goals: Array<{ id: string; title: string }>, category: BalanceCategory): string | null {
	if (goals.length === 0) return null;
	if (goals.length === 1) return goals[0]!.id;

	const keywordsByCategory: Record<BalanceCategory, string[]> = {
		savings: ["saving", "savings"],
		emergency: ["emergency"],
		investment: ["invest", "investment"],
	};
	const keywords = keywordsByCategory[category];

	const matching = goals.filter((g) => {
		const t = normalizeTitle(g.title);
		return keywords.some((k) => t.includes(k));
	});

	if (matching.length === 1) return matching[0]!.id;

	// Ambiguous: multiple goals in same category. Avoid writing the wrong one.
	return null;
}

/**
 * Keeps goal.currentAmount aligned with the authoritative balance fields stored on BudgetPlan.
 *
 * Rules:
 * - Only updates categories present in `balances`.
 * - If there is exactly 1 goal for the category, update it.
 * - If multiple goals exist, update only when title keyword match is unambiguous.
 * - If ambiguous, skip (safe-by-default).
 */
export async function syncGoalCurrentAmountsFromBalances(params: {
	budgetPlanId: string;
	balances: Balances;
}): Promise<void> {
	const categories = (Object.keys(params.balances) as BalanceCategory[]).filter((c) => {
		const v = params.balances[c];
		return typeof v === "number" && Number.isFinite(v);
	});
	if (categories.length === 0) return;

	const goals = await prisma.goal.findMany({
		where: {
			budgetPlanId: params.budgetPlanId,
			category: { in: categories },
		},
		select: {
			id: true,
			title: true,
			category: true,
		},
	});

	if (goals.length === 0) return;

	const byCategory = new Map<BalanceCategory, Array<{ id: string; title: string }>>();
	for (const cat of categories) byCategory.set(cat, []);
	for (const g of goals) {
		const cat = g.category as BalanceCategory;
		if (!byCategory.has(cat)) continue;
		byCategory.get(cat)!.push({ id: String(g.id), title: String(g.title ?? "") });
	}

	await prisma.$transaction(async (tx) => {
		for (const cat of categories) {
			const balance = params.balances[cat];
			if (!(typeof balance === "number" && Number.isFinite(balance))) continue;
			const candidates = byCategory.get(cat) ?? [];
			const goalId = pickGoalIdForCategory(candidates, cat);
			if (!goalId) continue;

			await tx.goal.update({
				where: { id: goalId },
				data: { currentAmount: Math.max(0, balance) },
			});
		}
	});
}
