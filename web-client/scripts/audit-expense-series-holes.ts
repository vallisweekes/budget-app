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
	return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeSeriesKey(value: string): string {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 160);
}

function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
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
	const monthsBack = Math.max(3, Math.min(36, toInt(args.monthsBack ?? process.env.MONTHS_BACK, 18)));
	const maxGroups = Math.max(10, Math.min(500, toInt(args.maxGroups ?? process.env.MAX_GROUPS, 80)));

	const end = { year, month: new Date().getMonth() + 1 };
	let startYear = end.year;
	let startMonth = end.month;
	for (let i = 0; i < monthsBack - 1; i += 1) {
		startMonth -= 1;
		if (startMonth <= 0) {
			startMonth = 12;
			startYear -= 1;
		}
	}

	const startKey = monthKey(startYear, startMonth);
	const endKey = monthKey(end.year, end.month);

	console.log(
		`Auditing series holes: plan=${budgetPlanId} window=${startKey}..${endKey} (monthsBack=${monthsBack})`
	);

	const rows = await prisma.expense.findMany({
		where: {
			budgetPlanId,
			isAllocation: false,
			OR: [
				{ year: { gt: startYear, lt: end.year } },
				{ year: startYear, month: { gte: startMonth } },
				{ year: end.year, month: { lte: end.month } },
			],
		},
		select: {
			id: true,
			name: true,
			merchantDomain: true,
			seriesKey: true,
			amount: true,
			categoryId: true,
			month: true,
			year: true,
			dueDate: true,
			paid: true,
			paidAmount: true,
			createdAt: true,
		},
		orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
	});

	if (!rows.length) {
		console.log("No expenses found in the requested window.");
		return;
	}

	type Group = {
		seriesKey: string;
		sampleName: string;
		merchantDomain: string | null;
		categoryId: string | null;
		months: Set<string>;
		names: Set<string>;
		count: number;
	};

	const groups = new Map<string, Group>();
	for (const r of rows) {
		const key = normalizeSeriesKey(String(r.seriesKey ?? r.merchantDomain ?? r.name ?? ""));
		if (!key) continue;
		const g = groups.get(key) ?? {
			seriesKey: key,
			sampleName: String(r.name ?? ""),
			merchantDomain: r.merchantDomain ?? null,
			categoryId: r.categoryId ?? null,
			months: new Set<string>(),
			names: new Set<string>(),
			count: 0,
		};
		g.months.add(monthKey(r.year, r.month));
		g.names.add(String(r.name ?? "").trim());
		g.count += 1;
		if (!g.sampleName) g.sampleName = String(r.name ?? "");
		groups.set(key, g);
	}

	function withinWindow(yk: string) {
		return yk >= startKey && yk <= endKey;
	}

	type HoleReport = {
		seriesKey: string;
		sampleName: string;
		namesCount: number;
		present: string[];
		missing: string[];
		count: number;
	};

	const reports: HoleReport[] = [];

	for (const g of groups.values()) {
		const presentSorted = [...g.months].filter(withinWindow).sort();
		if (presentSorted.length < 2) continue;

		const min = presentSorted[0];
		const max = presentSorted[presentSorted.length - 1];
		if (!min || !max) continue;

		const missing: string[] = [];
		let y = Number(min.slice(0, 4));
		let m = Number(min.slice(5, 7));
		const maxY = Number(max.slice(0, 4));
		const maxM = Number(max.slice(5, 7));
		const presentSet = new Set(presentSorted);

		while (y < maxY || (y === maxY && m <= maxM)) {
			const k = monthKey(y, m);
			if (withinWindow(k) && !presentSet.has(k)) missing.push(k);
			m += 1;
			if (m >= 13) {
				m = 1;
				y += 1;
			}
		}

		if (missing.length) {
			reports.push({
				seriesKey: g.seriesKey,
				sampleName: g.sampleName,
				namesCount: g.names.size,
				present: presentSorted,
				missing,
				count: g.count,
			});
		}
	}

	reports.sort((a, b) => b.missing.length - a.missing.length || b.count - a.count);

	console.log(`\nSeries with holes (showing up to ${maxGroups}): ${reports.length}`);
	for (const r of reports.slice(0, maxGroups)) {
		console.log(
			`- ${r.sampleName} (seriesKey=${r.seriesKey}) count=${r.count} names=${r.namesCount} missing=${r.missing.length}`
		);
		console.log(`  present: ${r.present.join(", ")}`);
		console.log(`  missing: ${r.missing.join(", ")}`);
	}

	if (!reports.length) {
		console.log("\nNo obvious series holes found in the window.");
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
