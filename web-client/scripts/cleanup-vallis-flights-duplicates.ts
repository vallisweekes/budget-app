import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hasFlag(name: string) {
	return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	const next = process.argv[idx + 1];
	if (!next || next.startsWith("--")) return undefined;
	return next;
}

function toInt(v: string | undefined, fallback: number) {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

async function main() {
	const apply = hasFlag("--apply");
	const year = toInt(argValue("--year"), 2026);
	const userName = (argValue("--user") ?? "vallis").trim();
	const planName = (argValue("--plan") ?? "Antigua").trim();
	const q = (argValue("--q") ?? "Flights").trim();
	const keepMonth = toInt(argValue("--keep-month"), 5);
	const deleteMonthsRaw = (argValue("--delete-months") ?? "6,7").trim();
	const deleteMonths = deleteMonthsRaw
		.split(",")
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);

	const user = await prisma.user.findFirst({
		where: { name: userName },
		include: { budgetPlans: true },
	});

	if (!user) {
		throw new Error(`User '${userName}' not found`);
	}

	const plan = user.budgetPlans.find((p) => p.name === planName);
	if (!plan) {
		throw new Error(
			`Plan '${planName}' not found for user '${userName}'. Available: ${user.budgetPlans
				.map((p) => p.name)
				.join(", ")}`,
		);
	}

	const keepRows = await prisma.expense.findMany({
		where: {
			budgetPlanId: plan.id,
			year,
			month: keepMonth,
			name: { equals: q, mode: "insensitive" },
		},
		select: { id: true, name: true, month: true, year: true, amount: true, createdAt: true },
	});

	const dupRows = await prisma.expense.findMany({
		where: {
			budgetPlanId: plan.id,
			year,
			month: { in: deleteMonths },
			name: { equals: q, mode: "insensitive" },
		},
		orderBy: [{ month: "asc" }, { createdAt: "asc" }],
		select: { id: true, name: true, month: true, year: true, amount: true, createdAt: true },
	});

	console.log(`User: ${user.name} (${user.id})`);
	console.log(`Plan: ${plan.kind} :: ${plan.name} (${plan.id})`);
	console.log(`Target: name='${q}', year=${year}`);
	console.log(`Keep month: ${keepMonth} (${keepRows.length} row(s))`);
	for (const r of keepRows) {
		console.log(
			`  KEEP ${r.year}-${String(r.month).padStart(2, "0")} | amount=${r.amount.toString()} | id=${r.id} | createdAt=${r.createdAt.toISOString()}`,
		);
	}

	console.log(`Delete months: ${deleteMonths.join(",")} (${dupRows.length} row(s))`);
	for (const r of dupRows) {
		console.log(
			`  DEL  ${r.year}-${String(r.month).padStart(2, "0")} | amount=${r.amount.toString()} | id=${r.id} | createdAt=${r.createdAt.toISOString()}`,
		);
	}

	if (!apply) {
		console.log("\nDry run only. Re-run with --apply to delete.");
		return;
	}

	if (!dupRows.length) {
		console.log("\nNothing to delete.");
		return;
	}

	const ids = dupRows.map((r) => r.id);
	const res = await prisma.expense.deleteMany({ where: { id: { in: ids } } });
	console.log(`\nDeleted rows: ${res.count}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
