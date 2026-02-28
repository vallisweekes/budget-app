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

function toNum(v: unknown): number {
	const n = typeof v === "number" ? v : Number((v as { toString?: () => string } | null | undefined)?.toString?.() ?? v ?? 0);
	return Number.isFinite(n) ? n : 0;
}

function norm(s: unknown): string {
	return String(s || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 160);
}

function tokenize(s: unknown): string[] {
	return String(s || "")
		.trim()
		.toLowerCase()
		.split(/[^a-z0-9]+/g)
		.map((t) => t.trim())
		.filter((t) => t.length >= 4)
		.filter((t) => !/^\d+$/.test(t));
}

function amountScore(a: number, b: number): number {
	a = Math.abs(a);
	b = Math.abs(b);
	if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 0;
	const r = Math.min(a, b) / Math.max(a, b);
	return Math.max(0, Math.min(20, Math.round(r * 20)));
}

function dayUTC(d: Date | null | undefined): number | null {
	return d ? d.getUTCDate() : null;
}

function dueScore(a: Date | null | undefined, b: Date | null | undefined): number {
	const da = dayUTC(a);
	const db = dayUTC(b);
	if (da == null || db == null) return 0;
	const diff = Math.abs(da - db);
	if (diff <= 1) return 15;
	if (diff <= 3) return 10;
	if (diff <= 7) return 5;
	return 0;
}

function overlapScore(base: ReadonlySet<string>, candTokens: readonly string[]): number {
	let c = 0;
	for (const t of candTokens) {
		if (base.has(t)) c += 1;
	}
	return c;
}

function rangeScore(a: number, b: number, tolerance: number): number {
	if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(tolerance) || tolerance <= 0) return 0;
	const diff = Math.abs(a - b);
	if (diff > tolerance) return 0;
	return Math.round(((tolerance - diff) / tolerance) * 20);
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
	const email = args.email ?? process.env.EMAIL ?? "vallis.weekes@gmail.com";
	const year = toInt(args.year ?? process.env.YEAR, 2026);
	const janMonth = 1;
	const febMonth = 2;
	const pepperFebId = args.pepperFebId ?? process.env.PEPPER_FEB_ID ?? "cmlkz9fm50003pzd39kaj6wvz";
	const maxSuggestions = Math.max(5, Math.min(200, toInt(args.max ?? process.env.MAX, 50)));

	const user = await prisma.user.findFirst({
		where: { email: { equals: email, mode: "insensitive" } },
		select: { id: true, email: true, name: true },
	});
	if (!user) {
		console.log("No user found for", email);
		return;
	}

	const plans = await prisma.budgetPlan.findMany({
		where: { userId: user.id },
		select: { id: true, name: true, kind: true, currency: true },
	});
	const planIds = plans.map((p) => p.id);

	console.log("USER", user);
	console.log("PLANS", plans);

	const selectExpense = {
		id: true,
		name: true,
		merchantDomain: true,
		amount: true,
		paid: true,
		paidAmount: true,
		categoryId: true,
		dueDate: true,
		year: true,
		month: true,
		budgetPlanId: true,
		createdAt: true,
	} as const;

	const [jan, feb] = await Promise.all([
		prisma.expense.findMany({
			where: { budgetPlanId: { in: planIds }, year, month: janMonth, isAllocation: false },
			select: selectExpense,
			orderBy: [{ budgetPlanId: "asc" }, { categoryId: "asc" }, { createdAt: "asc" }],
		}),
		prisma.expense.findMany({
			where: { budgetPlanId: { in: planIds }, year, month: febMonth, isAllocation: false },
			select: selectExpense,
			orderBy: [{ budgetPlanId: "asc" }, { categoryId: "asc" }, { createdAt: "asc" }],
		}),
	]);

	console.log("JAN_COUNT", jan.length);
	console.log("FEB_COUNT", feb.length);

	const janByKey = new Map<string, typeof jan>();
	for (const e of jan) {
		const key = norm(e.merchantDomain ?? e.name);
		if (!key) continue;
		const arr = janByKey.get(key) ?? [];
		arr.push(e);
		janByKey.set(key, arr);
	}

	const pepperFeb = feb.find((e) => e.id === pepperFebId) ?? null;
	if (!pepperFeb) {
		console.log("Pepper Feb expense not found for id", pepperFebId);
	} else {
		console.log("\nPEPPER_FEB", {
			id: pepperFeb.id,
			name: pepperFeb.name,
			dom: pepperFeb.merchantDomain ?? null,
			amount: toNum(pepperFeb.amount),
			paid: pepperFeb.paid,
			paidAmount: toNum(pepperFeb.paidAmount),
			cat: pepperFeb.categoryId ?? null,
			due: pepperFeb.dueDate ? pepperFeb.dueDate.toISOString().slice(0, 10) : null,
			plan: plans.find((p) => p.id === pepperFeb.budgetPlanId)?.name ?? pepperFeb.budgetPlanId,
			key: norm(pepperFeb.merchantDomain ?? pepperFeb.name),
		});

		const pepperKey = norm(pepperFeb.merchantDomain ?? pepperFeb.name);
		const direct = janByKey.get(pepperKey) ?? [];
		console.log(
			"PEPPER_JAN_DIRECT_KEY_MATCHES",
			direct.map((e) => ({
				id: e.id,
				name: e.name,
				dom: e.merchantDomain ?? null,
				amount: toNum(e.amount),
				paid: e.paid,
				paidAmount: toNum(e.paidAmount),
				due: e.dueDate ? e.dueDate.toISOString().slice(0, 10) : null,
			}))
		);

		const baseTokens = new Set(tokenize(pepperFeb.name));
		const baseAmount = toNum(pepperFeb.amount);
		const baseDue = pepperFeb.dueDate;

		const janPool = jan.filter(
			(e) => e.budgetPlanId === pepperFeb.budgetPlanId && e.categoryId === pepperFeb.categoryId
		);
		let best:
			| {
				score: number;
				overlap: number;
				cand: (typeof jan)[number];
			}
			| null = null;
		for (const cand of janPool) {
			const ov = overlapScore(baseTokens, tokenize(cand.name));
			if (ov <= 0) continue;
			const score =
				(100 + ov * 10) +
				amountScore(baseAmount, toNum(cand.amount)) +
				dueScore(baseDue, cand.dueDate);
			if (!best || score > best.score) best = { score, overlap: ov, cand };
		}

		console.log(
			"PEPPER_JAN_BEST_TOKEN_MATCH",
			best
				? {
					score: best.score,
					overlap: best.overlap,
					id: best.cand.id,
					name: best.cand.name,
					dom: best.cand.merchantDomain ?? null,
					amount: toNum(best.cand.amount),
					paid: best.cand.paid,
					paidAmount: toNum(best.cand.paidAmount),
					due: best.cand.dueDate ? best.cand.dueDate.toISOString().slice(0, 10) : null,
				}
				: null
		);

		if (!best) {
			const broadPool = jan.filter((e) => e.budgetPlanId === pepperFeb.budgetPlanId);
			let bestBroad:
				| {
					score: number;
					overlap: number;
					cand: (typeof jan)[number];
				}
				| null = null;
			for (const cand of broadPool) {
				const ov = overlapScore(baseTokens, tokenize(cand.name));
				const amtScore = amountScore(baseAmount, toNum(cand.amount));
				const nearScore = rangeScore(baseAmount, toNum(cand.amount), 25);
				if (ov <= 0 && nearScore <= 0) continue;
				const score = (ov > 0 ? 100 + ov * 10 : 0) + amtScore + nearScore + dueScore(baseDue, cand.dueDate);
				if (!bestBroad || score > bestBroad.score) bestBroad = { score, overlap: ov, cand };
			}
			console.log(
				"PEPPER_JAN_BEST_BROAD_MATCH_SAME_PLAN",
				bestBroad
					? {
						score: bestBroad.score,
						overlap: bestBroad.overlap,
						id: bestBroad.cand.id,
						name: bestBroad.cand.name,
						dom: bestBroad.cand.merchantDomain ?? null,
						amount: toNum(bestBroad.cand.amount),
						paid: bestBroad.cand.paid,
						paidAmount: toNum(bestBroad.cand.paidAmount),
						cat: bestBroad.cand.categoryId ?? null,
						due: bestBroad.cand.dueDate ? bestBroad.cand.dueDate.toISOString().slice(0, 10) : null,
					}
					: null
			);
		}

		const dumpPayments = async (expenseId: string, label: string) => {
			const rows = await prisma.expensePayment.findMany({
				where: { expenseId },
				select: { id: true, amount: true, paidAt: true, source: true, debtId: true },
				orderBy: { paidAt: "desc" },
			});
			const sum = rows.reduce((s, r) => s + toNum(r.amount), 0);
			console.log(`${label}_PAYMENTS`, {
				count: rows.length,
				sum,
				rows: rows.slice(0, 20).map((r) => ({
					id: r.id,
					amount: toNum(r.amount),
					paidAt: r.paidAt.toISOString(),
					source: r.source,
					debtId: r.debtId ?? null,
				})),
			});
		};

		await dumpPayments(pepperFeb.id, "PEPPER_FEB");
		if (best?.cand?.id) await dumpPayments(best.cand.id, "PEPPER_JAN");

		const pepperNeedle = "pepper";
		const pepperDebts = await prisma.debt.findMany({
			where: {
				budgetPlanId: pepperFeb.budgetPlanId,
				name: { contains: pepperNeedle, mode: "insensitive" },
			},
			select: { id: true, name: true, type: true, currentBalance: true, sourceExpenseId: true },
			orderBy: { createdAt: "asc" },
		});
		console.log("\nPEPPER_DEBTS_SAME_PLAN", pepperDebts.map((d) => ({
			id: d.id,
			name: d.name,
			type: d.type,
			currentBalance: toNum(d.currentBalance),
			sourceExpenseId: d.sourceExpenseId ?? null,
		})));

		const approx = baseAmount;
		const janDebtPays = await prisma.debtPayment.findMany({
			where: {
				debt: { budgetPlanId: pepperFeb.budgetPlanId },
				year,
				month: janMonth,
			},
			select: { id: true, amount: true, paidAt: true, debtId: true, source: true, debt: { select: { name: true } } },
			orderBy: { paidAt: "desc" },
		});
		const near = janDebtPays
			.map((p) => ({
				...p,
				amountN: toNum(p.amount),
				diff: Math.abs(toNum(p.amount) - approx),
			}))
			.filter((p) => p.diff <= 25)
			.sort((a, b) => a.diff - b.diff)
			.slice(0, 20)
			.map((p) => ({
				id: p.id,
				debtId: p.debtId,
				debtName: p.debt.name,
				amount: p.amountN,
				diff: p.diff,
				paidAt: p.paidAt.toISOString(),
				source: p.source,
			}));
		console.log("\nJAN_DEBT_PAYMENTS_NEAR_PEPPER_AMOUNT", near);
	}

	const febWithoutJanDirect = feb.filter((e) => {
		const key = norm(e.merchantDomain ?? e.name);
		if (!key) return false;
		return !(janByKey.get(key)?.length);
	});

	console.log(`\nFEB_WITHOUT_JAN_DIRECT_KEY_MATCH: ${febWithoutJanDirect.length}`);

	type Suggestion = {
		feb: { id: string; name: string; amount: number; cat: string | null; planId: string };
		jan: { id: string; name: string; amount: number; score: number; overlap: number };
	};

	const suggestions: Suggestion[] = [];
	for (const e of febWithoutJanDirect) {
		const baseTokens = new Set(tokenize(e.name));
		if (baseTokens.size === 0) continue;
		const baseAmount = toNum(e.amount);
		const baseDue = e.dueDate;
		const janPool = jan.filter((j) => j.budgetPlanId === e.budgetPlanId && j.categoryId === e.categoryId);
		let best: { score: number; overlap: number; cand: (typeof jan)[number] } | null = null;
		for (const cand of janPool) {
			const ov = overlapScore(baseTokens, tokenize(cand.name));
			if (ov <= 0) continue;
			const score =
				(100 + ov * 10) +
				amountScore(baseAmount, toNum(cand.amount)) +
				dueScore(baseDue, cand.dueDate);
			if (!best || score > best.score) best = { score, overlap: ov, cand };
		}
		if (!best) continue;
		suggestions.push({
			feb: {
				id: e.id,
				name: e.name,
				amount: baseAmount,
				cat: e.categoryId ?? null,
				planId: e.budgetPlanId,
			},
			jan: {
				id: best.cand.id,
				name: best.cand.name,
				amount: toNum(best.cand.amount),
				score: best.score,
				overlap: best.overlap,
			},
		});
	}

	suggestions.sort((a, b) => b.jan.score - a.jan.score);

	console.log(`\nTOP_LIKELY_RENAMES (first ${maxSuggestions}):`);
	for (const s of suggestions.slice(0, maxSuggestions)) {
		const planName = plans.find((p) => p.id === s.feb.planId)?.name ?? s.feb.planId;
		console.log(
			`- [${planName}] FEB ${s.feb.name} £${s.feb.amount.toFixed(2)} -> JAN ${s.jan.name} £${s.jan.amount.toFixed(2)} (score=${s.jan.score}, ov=${s.jan.overlap})`
		);
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
