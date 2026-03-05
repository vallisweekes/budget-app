/**
 * One-time realignment: ensure early DebtPayment rows count toward the intended upcoming pay period.
 *
 * For each DebtPayment, we compute the next due date after the payment date (using debt.dueDay
 * or debt.dueDate's day-of-month). If the payment happened BEFORE the start of the pay period
 * that contains that due date, we rewrite debtPayment.periodKey to that upcoming periodKey.
 *
 * This avoids huge lookback windows and matches the new write-time behavior where
 * debtPayment.periodKey is derived from the debt's intended cycle.
 *
 * Usage:
 *   npx tsx scripts/realign-debt-payment-period-keys.ts --dry-run
 *   npx tsx scripts/realign-debt-payment-period-keys.ts --apply
 *   npx tsx scripts/realign-debt-payment-period-keys.ts --apply --budgetPlanId=<id>
 */

import { PrismaClient } from "@prisma/client";
import { getPeriodKey, parsePeriodKeyRange } from "../lib/helpers/periodKey";

const prisma = new PrismaClient();

type Options = {
	apply: boolean;
	dryRun: boolean;
	budgetPlanId?: string;
};

function parseArgs(argv: string[]): Options {
	let apply = false;
	let dryRun = false;
	let budgetPlanId: string | undefined;

	for (const raw of argv) {
		const arg = String(raw ?? "").trim();
		if (!arg) continue;
		if (arg === "--apply") apply = true;
		if (arg === "--dry-run") dryRun = true;
		if (arg.startsWith("--budgetPlanId=")) {
			budgetPlanId = arg.slice("--budgetPlanId=".length).trim() || undefined;
		}
	}

	if (apply && dryRun) {
		// Prefer safety.
		apply = false;
	}

	return { apply, dryRun: dryRun || !apply, budgetPlanId };
}

function clampDayUtc(year: number, month0: number, day: number): number {
	const max = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
	return Math.max(1, Math.min(max, Math.floor(day)));
}

function startOfUtcDay(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Next due date after `paidAt` using a dueDay (day-of-month). */
function nextDueDateAfter(paidAt: Date, dueDay: number): Date {
	const paidDay = startOfUtcDay(paidAt);
	const y = paidDay.getUTCFullYear();
	const m = paidDay.getUTCMonth();
	const dayThisMonth = clampDayUtc(y, m, dueDay);
	const candidate = new Date(Date.UTC(y, m, dayThisMonth));
	if (candidate.getTime() > paidDay.getTime()) return candidate;

	const nextMonth = new Date(Date.UTC(y, m + 1, 1));
	const ny = nextMonth.getUTCFullYear();
	const nm = nextMonth.getUTCMonth();
	const dayNextMonth = clampDayUtc(ny, nm, dueDay);
	return new Date(Date.UTC(ny, nm, dayNextMonth));
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	console.log(opts.dryRun ? "=== DRY RUN ===" : "=== APPLY ===");
	if (opts.budgetPlanId) console.log(`- budgetPlanId filter: ${opts.budgetPlanId}`);

	// Load plan payDates for period computations.
	const plans = await prisma.budgetPlan.findMany({
		where: opts.budgetPlanId ? { id: opts.budgetPlanId } : undefined,
		select: { id: true, payDate: true },
	});
	const payDateByPlanId = new Map(plans.map((p) => [p.id, Number(p.payDate ?? 27)]));

	const payments = await prisma.debtPayment.findMany({
		where: {
			...(opts.budgetPlanId ? { debt: { budgetPlanId: opts.budgetPlanId } } : {}),
		},
		select: {
			id: true,
			paidAt: true,
			periodKey: true,
			debt: {
				select: {
					id: true,
					budgetPlanId: true,
					dueDay: true,
					dueDate: true,
				},
			},
		},
		orderBy: { paidAt: "asc" },
	});

	let wouldUpdate = 0;
	let updated = 0;
	let skipped = 0;

	const updates: Array<{ id: string; periodKey: string }> = [];

	for (const p of payments) {
		const payDate = payDateByPlanId.get(p.debt.budgetPlanId);
		if (!payDate || !Number.isFinite(payDate) || payDate < 1) {
			skipped++;
			continue;
		}

		const dueDay =
			(typeof p.debt.dueDay === "number" && Number.isFinite(p.debt.dueDay) && p.debt.dueDay > 0
				? Math.trunc(p.debt.dueDay)
				: p.debt.dueDate && Number.isFinite(p.debt.dueDate.getTime())
					? p.debt.dueDate.getUTCDate()
					: null);
		if (!dueDay) {
			skipped++;
			continue;
		}

		const nextDue = nextDueDateAfter(p.paidAt, dueDay);
		const targetPeriodKey = getPeriodKey(nextDue, payDate);
		let targetStart: Date;
		try {
			targetStart = parsePeriodKeyRange(targetPeriodKey, payDate).start;
		} catch {
			skipped++;
			continue;
		}

		// Only realign genuinely-early payments: those made before the target period starts.
		if (p.paidAt.getTime() >= targetStart.getTime()) {
			continue;
		}

		if (String(p.periodKey ?? "") === targetPeriodKey) {
			continue;
		}

		updates.push({ id: p.id, periodKey: targetPeriodKey });
	}

	wouldUpdate = updates.length;
	console.log(`Payments scanned: ${payments.length}`);
	console.log(`${opts.dryRun ? "Would update" : "To update"}: ${wouldUpdate}`);
	console.log(`Skipped (insufficient due info / payDate): ${skipped}`);

	if (opts.dryRun) {
		console.log("\nPreview (first 10)");
		for (const u of updates.slice(0, 10)) {
			console.log(`- ${u.id} -> ${u.periodKey}`);
		}
		return;
	}

	if (updates.length === 0) return;

	const BATCH = 100;
	for (let i = 0; i < updates.length; i += BATCH) {
		const batch = updates.slice(i, i + BATCH);
		await prisma.$transaction(
			batch.map((u) => prisma.debtPayment.update({ where: { id: u.id }, data: { periodKey: u.periodKey } })),
		);
		updated += batch.length;
		process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(updates.length / BATCH)}\r`);
	}
	console.log();
	console.log(`Updated: ${updated}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
