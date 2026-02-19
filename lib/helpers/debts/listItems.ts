import type { DebtCardDebt } from "@/types/components/debts";
import { cleanExpenseDebtBaseName } from "@/lib/helpers/debts/expenseDebtLabels";

export type DebtSortOption = "default" | "name" | "amount";

export type DebtListItem =
	| {
			kind: "expenseGroup";
			key: string;
			title: string;
			debts: DebtCardDebt[];
			totalCurrentBalance: number;
			totalDue: number;
	  }
	| { kind: "debt"; debt: DebtCardDebt };

export function buildDebtListItems(debts: DebtCardDebt[], sortBy: DebtSortOption): DebtListItem[] {
	const hasExpenseDebts = debts.some((d) => d.sourceType === "expense");
	const sorted = [...debts];

	if (sortBy === "name") {
		sorted.sort((a, b) => a.name.localeCompare(b.name));
	} else if (sortBy === "amount") {
		sorted.sort((a, b) => b.currentBalance - a.currentBalance);
	}

	if (!hasExpenseDebts) {
		return sorted.map((debt) => ({ kind: "debt" as const, debt }));
	}

	const groups = new Map<
		string,
		{ key: string; title: string; debts: DebtCardDebt[]; totalCurrentBalance: number; totalDue: number }
	>();
	const passthrough: DebtCardDebt[] = [];

	for (const debt of sorted) {
		if (debt.sourceType !== "expense") {
			passthrough.push(debt);
			continue;
		}

		const baseName = (debt.sourceExpenseName ?? "").trim() || debt.name;
		const categoryName = (debt.sourceCategoryName ?? "").trim();
		const cleanBaseName = cleanExpenseDebtBaseName(baseName, categoryName);
		const title = cleanBaseName;
		const key = `${categoryName.toLowerCase()}|${cleanBaseName.toLowerCase()}`;

		const existing = groups.get(key);
		if (existing) {
			existing.debts.push(debt);
			existing.totalCurrentBalance += debt.currentBalance;
			existing.totalDue += debt.amount;
		} else {
			groups.set(key, {
				key,
				title,
				debts: [debt],
				totalCurrentBalance: debt.currentBalance,
				totalDue: debt.amount,
			});
		}
	}

	const grouped = Array.from(groups.values());
	if (sortBy === "name") {
		grouped.sort((a, b) => a.title.localeCompare(b.title));
	} else if (sortBy === "amount") {
		grouped.sort((a, b) => b.totalCurrentBalance - a.totalCurrentBalance);
	}

	const items: DebtListItem[] = [];

	for (const group of grouped) {
		group.debts.sort((a, b) => (a.sourceMonthKey ?? "").localeCompare(b.sourceMonthKey ?? ""));
		items.push({
			kind: "expenseGroup",
			key: group.key,
			title: group.title,
			debts: group.debts,
			totalCurrentBalance: group.totalCurrentBalance,
			totalDue: group.totalDue,
		});
	}

	for (const debt of passthrough) items.push({ kind: "debt", debt });
	return items;
}
