import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";

async function main() {
	const plans = await prisma.budgetPlan.findMany({
		select: { id: true, userId: true, name: true, kind: true, categorySeedVersion: true },
		orderBy: [{ createdAt: "asc" }],
	});

	console.log(`Found ${plans.length} budget plans. Syncing default categories...`);

	let ok = 0;
	let failed = 0;
	for (const plan of plans) {
		try {
			await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: plan.id });
			ok += 1;
		} catch (err: any) {
			failed += 1;
			console.error(
				`✗ Failed for plan ${plan.id} (${plan.kind} - ${plan.name}, user ${plan.userId}):`,
				err?.message || err
			);
		}
	}

	console.log(`✓ Done. Successful: ${ok}, failed: ${failed}`);
	if (failed > 0) process.exitCode = 1;
}

main()
	.catch((e) => {
		console.error("✗ Sync failed:", e?.message || e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
