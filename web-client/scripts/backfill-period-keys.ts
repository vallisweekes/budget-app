/**
 * Backfill periodKey on existing Expense, ExpensePayment, DebtPayment, and Income records.
 *
 * Usage:
 *   npx tsx scripts/backfill-period-keys.ts          # live run
 *   npx tsx scripts/backfill-period-keys.ts --dry-run # preview only
 */
import { PrismaClient } from "@prisma/client";
import {
	getExpensePeriodKey,
	getPaymentPeriodKey,
	getIncomePeriodKey,
} from "../lib/helpers/periodKey";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
	console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

	// Get default payDate from budget plans
	const plans = await prisma.budgetPlan.findMany({
		select: { id: true, payDate: true },
	});
	const payDateByPlan = new Map<string, number>();
	for (const p of plans) {
		payDateByPlan.set(p.id, Number(p.payDate ?? 27));
	}

	// Helper: batch updates using $transaction
	async function batchUpdate(
		model: "expense" | "expensePayment" | "debtPayment" | "income",
		updates: { id: string; periodKey: string }[],
	) {
		if (DRY_RUN || updates.length === 0) return;
		const BATCH = 50;
		for (let i = 0; i < updates.length; i += BATCH) {
			const batch = updates.slice(i, i + BATCH);
			await prisma.$transaction(
				batch.map((u) =>
					(prisma[model] as any).update({ where: { id: u.id }, data: { periodKey: u.periodKey } }),
				),
			);
			process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(updates.length / BATCH)}\r`);
		}
		console.log();
	}

	// 1. Expenses
	const expenses = await prisma.expense.findMany({
		where: { periodKey: null },
		select: { id: true, dueDate: true, year: true, month: true, budgetPlanId: true },
	});
	console.log(`\nExpenses to backfill: ${expenses.length}`);
	const expUpdates = expenses.map((exp) => {
		const payDate = payDateByPlan.get(exp.budgetPlanId) ?? 27;
		return { id: exp.id, periodKey: getExpensePeriodKey(exp, payDate) };
	});
	await batchUpdate("expense", expUpdates);
	console.log(`  Updated: ${expUpdates.length}`);

	// 2. ExpensePayments
	const expPayments = await prisma.expensePayment.findMany({
		where: { periodKey: null },
		select: { id: true, paidAt: true, expense: { select: { budgetPlanId: true } } },
	});
	console.log(`\nExpensePayments to backfill: ${expPayments.length}`);
	const epUpdates = expPayments.map((ep) => {
		const payDate = payDateByPlan.get(ep.expense.budgetPlanId) ?? 27;
		return { id: ep.id, periodKey: getPaymentPeriodKey(ep.paidAt, payDate) };
	});
	await batchUpdate("expensePayment", epUpdates);
	console.log(`  Updated: ${epUpdates.length}`);

	// 3. DebtPayments
	const debtPayments = await prisma.debtPayment.findMany({
		where: { periodKey: null },
		select: { id: true, paidAt: true, debt: { select: { budgetPlanId: true } } },
	});
	console.log(`\nDebtPayments to backfill: ${debtPayments.length}`);
	const dpUpdates = debtPayments.map((dp) => {
		const payDate = payDateByPlan.get(dp.debt.budgetPlanId) ?? 27;
		return { id: dp.id, periodKey: getPaymentPeriodKey(dp.paidAt, payDate) };
	});
	await batchUpdate("debtPayment", dpUpdates);
	console.log(`  Updated: ${dpUpdates.length}`);

	// 4. Income
	const incomeRecords = await prisma.income.findMany({
		where: { periodKey: null },
		select: { id: true, year: true, month: true, budgetPlanId: true, name: true },
	});
	console.log(`\nIncome to backfill: ${incomeRecords.length}`);
	const incUpdates = incomeRecords.map((inc) => {
		const payDate = payDateByPlan.get(inc.budgetPlanId) ?? 27;
		return { id: inc.id, periodKey: getIncomePeriodKey(inc, payDate) };
	});
	await batchUpdate("income", incUpdates);
	console.log(`  Updated: ${incUpdates.length}`);

	console.log(`\n=== TOTAL: ${expUpdates.length + epUpdates.length + dpUpdates.length + incUpdates.length} records ${DRY_RUN ? "would be" : ""} updated ===`);

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error(e);
	await prisma.$disconnect();
	process.exit(1);
});
