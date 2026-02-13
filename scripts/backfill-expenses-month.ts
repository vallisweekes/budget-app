import { PrismaClient } from "@prisma/client";

function parseArgs(argv: string[]) {
	const args: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a?.startsWith("--")) continue;
		const key = a.slice(2);
		const val = argv[i + 1];
		if (val && !val.startsWith("--")) {
			args[key] = val;
			i++;
		} else {
			args[key] = "true";
		}
	}
	return args;
}

function toInt(value: string | undefined, fallback: number) {
	const n = value == null ? NaN : Number(value);
	return Number.isFinite(n) ? n : fallback;
}

const scriptDatasourceUrl =
	process.env.DATABASE_URL_UNPOOLED ??
	process.env.POSTGRES_URL_NON_POOLING ??
	process.env.POSTGRES_URL_NON_POOLING?.replace?.("postgres://", "postgresql://") ??
	undefined;

const prisma = new PrismaClient({
	datasources: scriptDatasourceUrl
		? {
			db: {
				url: scriptDatasourceUrl,
			},
		}
		: undefined,
});

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const budgetPlanId = args.plan ?? process.env.PLAN_ID;
	if (!budgetPlanId) {
		throw new Error("Missing --plan <budgetPlanId> (or PLAN_ID env var)");
	}

	const year = toInt(args.year ?? process.env.YEAR, new Date().getFullYear());
	const sourceMonth = toInt(args.sourceMonth ?? process.env.SOURCE_MONTH, 1);
	const targetMonth = toInt(args.targetMonth ?? process.env.TARGET_MONTH, 2);

	if (sourceMonth < 1 || sourceMonth > 12) throw new Error("sourceMonth must be 1-12");
	if (targetMonth < 1 || targetMonth > 12) throw new Error("targetMonth must be 1-12");
	if (sourceMonth === targetMonth) throw new Error("sourceMonth and targetMonth must differ");

	const [sourceRows, targetRows] = await Promise.all([
		prisma.expense.findMany({
			where: { budgetPlanId, year, month: sourceMonth },
			select: { name: true, amount: true, paid: true, paidAmount: true, categoryId: true },
			orderBy: [{ createdAt: "asc" }],
		}),
		prisma.expense.findMany({
			where: { budgetPlanId, year, month: targetMonth },
			select: { name: true },
		}),
	]);

	const existingTargetNames = new Set(
		targetRows.map((r) => String(r.name ?? "").trim().toLowerCase()).filter(Boolean)
	);

	if (sourceRows.length === 0) {
		console.log(`No source expenses found for month ${sourceMonth}, year ${year}. Nothing to backfill.`);
		return;
	}

	console.log(
		`Backfilling expenses: plan=${budgetPlanId} year=${year} sourceMonth=${sourceMonth} targetMonth=${targetMonth} (target currently has ${existingTargetNames.size})`
	);

	let created = 0;
	let skipped = 0;

	for (const row of sourceRows) {
		const key = String(row.name ?? "").trim().toLowerCase();
		if (!key) {
			skipped++;
			continue;
		}
		if (existingTargetNames.has(key)) {
			skipped++;
			continue;
		}

		await prisma.expense.create({
			data: {
				budgetPlanId,
				year,
				month: targetMonth,
				name: row.name,
				amount: row.amount,
				paid: row.paid,
				paidAmount: row.paidAmount,
				categoryId: row.categoryId,
			},
		});
		existingTargetNames.add(key);
		created++;
	}

	console.log(`Done. created=${created} skipped=${skipped} targetCount=${existingTargetNames.size}`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
