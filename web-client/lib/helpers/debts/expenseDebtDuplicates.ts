import { cleanExpenseDebtBaseName } from "@/lib/helpers/debts/expenseDebtLabels";

type MaybeMoney = number | string | null | undefined | { toString?: () => string };

type RegularDebtLike = {
	name?: string | null;
	sourceType?: string | null;
	currentBalance?: MaybeMoney;
	paid?: boolean | null;
};

function toMoneyNumber(value: MaybeMoney): number {
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number(value);
	if (value && typeof value === "object" && typeof value.toString === "function") {
		return Number(value.toString());
	}
	return Number(value ?? 0);
}

function normalizeMatchText(value: string | null | undefined): string {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getExpenseMatchTokens(params: {
	expenseName?: string | null;
	sourceCategoryName?: string | null;
}): string[] {
	const cleanedExpenseName = cleanExpenseDebtBaseName(
		String(params.expenseName ?? ""),
		params.sourceCategoryName ?? null,
	);
	const sources = [cleanedExpenseName, String(params.sourceCategoryName ?? "")]
		.map(normalizeMatchText)
		.filter(Boolean);

	const tokens = new Set<string>();
	for (const source of sources) {
		tokens.add(source);
		for (const part of source.split(" ")) {
			if (part.length >= 4) tokens.add(part);
		}
	}

	return Array.from(tokens);
}

function isActiveRegularDebt(debt: RegularDebtLike): boolean {
	if (debt.sourceType === "expense") return false;
	if (debt.paid) return false;
	return toMoneyNumber(debt.currentBalance) > 0;
}

function hasArrearsSignal(name: string): boolean {
	return name.includes("arrears") || name.includes("overdue") || name.includes("missed");
}

export function isExpenseDebtCoveredByRegularDebt(params: {
	expenseName?: string | null;
	sourceCategoryName?: string | null;
	regularDebts: RegularDebtLike[];
}): boolean {
	const tokens = getExpenseMatchTokens(params);
	if (tokens.length === 0) return false;

	return params.regularDebts.some((debt) => {
		if (!isActiveRegularDebt(debt)) return false;
		const normalizedDebtName = normalizeMatchText(debt.name ?? "");
		if (!normalizedDebtName || !hasArrearsSignal(normalizedDebtName)) return false;
		return tokens.some((token) => normalizedDebtName.includes(token));
	});
}