/*
 * One-time backfill / reconciliation script.
 *
 * Ensures Goal.currentAmount matches the authoritative BudgetPlan balance fields:
 * - savingsBalance -> savings goal currentAmount
 * - emergencyBalance -> emergency goal currentAmount
 * - investmentBalance -> investment goal currentAmount
 *
 * Safe-by-default:
 * - Dry-run unless --apply is provided.
 * - If multiple goals exist in a category, only updates when the match is unambiguous.
 */

import { prisma } from "@/lib/prisma";

type BalanceCategory = "savings" | "emergency" | "investment";

type Args = {
	apply: boolean;
	budgetPlanId?: string;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { apply: false };
	for (const raw of argv) {
		const a = raw.trim();
		if (!a) continue;
		if (a === "--apply") args.apply = true;
		if (a.startsWith("--budgetPlanId=")) args.budgetPlanId = a.slice("--budgetPlanId=".length).trim();
	}
	return args;
}

function dn(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any)?.toString?.() ?? value);
}

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
	return null;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const isDryRun = !args.apply;

	console.log(isDryRun ? "DRY RUN: no writes" : "APPLY: writing updates");
	if (args.budgetPlanId) console.log(`Scope: budgetPlanId=${args.budgetPlanId}`);

	const plans = await prisma.budgetPlan.findMany({
		where: args.budgetPlanId ? { id: args.budgetPlanId } : undefined,
		select: {
			id: true,
			savingsBalance: true,
			emergencyBalance: true,
			investmentBalance: true,
		},
		orderBy: [{ createdAt: "asc" }],
	});

	let wouldUpdate = 0;
	let updated = 0;
	let skippedAmbiguous = 0;

	for (const plan of plans) {
		const balances: Record<BalanceCategory, number> = {
			savings: Math.max(0, dn((plan as any).savingsBalance)),
			emergency: Math.max(0, dn((plan as any).emergencyBalance)),
			investment: Math.max(0, dn((plan as any).investmentBalance)),
		};

		const goals = await prisma.goal.findMany({
			where: {
				budgetPlanId: plan.id,
				category: { in: ["savings", "emergency", "investment"] },
			},
			select: { id: true, title: true, category: true, currentAmount: true },
			orderBy: [{ createdAt: "asc" }],
		});

		if (goals.length === 0) continue;

		const byCat = new Map<BalanceCategory, Array<{ id: string; title: string; current: number }>>();
		byCat.set("savings", []);
		byCat.set("emergency", []);
		byCat.set("investment", []);

		for (const g of goals) {
			const cat = g.category as BalanceCategory;
			if (!byCat.has(cat)) continue;
			byCat.get(cat)!.push({ id: String(g.id), title: String(g.title ?? ""), current: dn(g.currentAmount) });
		}

		for (const cat of ["savings", "emergency", "investment"] as const) {
			const candidates = byCat.get(cat) ?? [];
			if (candidates.length === 0) continue;

			const chosenId = pickGoalIdForCategory(candidates.map((c) => ({ id: c.id, title: c.title })), cat);
			if (!chosenId) {
				if (candidates.length > 1) skippedAmbiguous++;
				continue;
			}

			const chosen = candidates.find((c) => c.id === chosenId);
			if (!chosen) continue;

			const next = balances[cat];
			if (Math.abs(chosen.current - next) < 0.005) continue;

			wouldUpdate++;
			console.log(
				`Plan ${plan.id}: ${cat} goal '${chosen.title}' ${chosen.current.toFixed(2)} -> ${next.toFixed(2)}`
			);

			if (!isDryRun) {
				await prisma.goal.update({ where: { id: chosen.id }, data: { currentAmount: next } });
				updated++;
			}
		}
	}

	console.log(`Would update: ${wouldUpdate}`);
	if (!isDryRun) console.log(`Updated: ${updated}`);
	if (skippedAmbiguous > 0) console.log(`Skipped (ambiguous category goals): ${skippedAmbiguous}`);
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (err) => {
		console.error(err);
		await prisma.$disconnect();
		process.exit(1);
	});
