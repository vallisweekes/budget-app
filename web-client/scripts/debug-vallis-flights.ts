import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
	const args = new Map<string, string>();
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) continue;
		const key = a.slice(2);
		const next = argv[i + 1];
		if (next && !next.startsWith("--")) {
			args.set(key, next);
			i++;
		} else {
			args.set(key, "true");
		}
	}
	return args;
}

function toInt(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

async function main() {
	const args = parseArgs(process.argv);
	const year = toInt(args.get("year"), 2026);
	const monthsRaw = args.get("months") ?? "5,6,7";
	const months = monthsRaw
		.split(",")
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
	const q = (args.get("q") ?? "flight").trim();
	const userName = (args.get("user") ?? "vallis").trim();

	const user = await prisma.user.findFirst({
		where: { name: userName },
		include: { budgetPlans: true },
	});

	if (!user) {
		console.error(`User ${userName} not found`);
		process.exitCode = 1;
		return;
	}

	console.log(`User: ${user.name} (${user.id}) ${user.email ?? ""}`);
	console.log(`Plans: ${user.budgetPlans.length}`);
	for (const p of user.budgetPlans) {
		console.log(`- ${p.kind} :: ${p.name} (${p.id})`);
	}

	for (const p of user.budgetPlans) {
		const rows = await prisma.expense.findMany({
			where: {
				budgetPlanId: p.id,
				year,
				month: { in: months },
				name: { contains: q, mode: "insensitive" },
			},
			orderBy: [{ month: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				name: true,
				amount: true,
				paid: true,
				paidAmount: true,
				month: true,
				year: true,
				createdAt: true,
				updatedAt: true,
				budgetPlanId: true,
			},
		});

		if (!rows.length) continue;
		console.log(`\nMatches in plan: ${p.kind} :: ${p.name}`);
		for (const r of rows) {
			console.log(
				`  ${r.year}-${String(r.month).padStart(2, "0")} | ${r.name} | amount=${r.amount.toString()} paid=${r.paid} paidAmount=${r.paidAmount.toString()} | id=${r.id} | createdAt=${r.createdAt.toISOString()}`,
			);
		}
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
