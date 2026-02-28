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

function normalizeSeriesKey(value: string): string {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 160);
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
	const apply = args.apply === "true" || args.apply === "1";
	const limit = Math.max(50, Math.min(50_000, Number(args.limit ?? process.env.LIMIT ?? 5_000)));

	const candidates = await prisma.expense.findMany({
		where: {
			budgetPlanId,
			seriesKey: null,
		},
		select: {
			id: true,
			name: true,
			merchantDomain: true,
			month: true,
			year: true,
		},
		take: limit,
		orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
	});

	if (!candidates.length) {
		console.log(`No expenses with seriesKey=null for plan=${budgetPlanId}.`);
		return;
	}

	console.log(
		`${apply ? "Backfilling" : "Dry-run"}: plan=${budgetPlanId} candidates=${candidates.length} (limit=${limit})`
	);

	let updated = 0;
	let skipped = 0;

	for (const e of candidates) {
		const key = normalizeSeriesKey(String(e.merchantDomain ?? e.name ?? ""));
		if (!key) {
			skipped += 1;
			continue;
		}

		if (!apply) {
			updated += 1;
			continue;
		}

		const res = await prisma.expense.updateMany({
			where: { id: e.id, seriesKey: null },
			data: { seriesKey: key },
		});
		updated += res.count;
	}

	console.log(`Done. wouldUpdateOrUpdated=${updated} skipped=${skipped}`);
	if (!apply) {
		console.log("Re-run with --apply to write changes.");
	}
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
