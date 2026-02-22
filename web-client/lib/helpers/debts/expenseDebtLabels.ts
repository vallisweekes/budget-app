import type { DebtCardDebt } from "@/types/components/debts";

function titleCaseIfAllCaps(value: string): string {
	const s = String(value ?? "").trim();
	if (!s) return s;
	const hasLetters = /[A-Za-z]/.test(s);
	if (!hasLetters) return s;
	if (s !== s.toUpperCase()) return s;
	return s
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

export function formatYearMonthLabel(sourceMonthKey?: string | null): string | null {
	const raw = String(sourceMonthKey ?? "").trim();
	if (!raw) return null;

	const match = raw.match(/^(\d{4})-(\d{2})$/);
	if (!match) return raw;

	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return raw;

	const date = new Date(Date.UTC(year, month - 1, 1));
	return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

export function cleanExpenseDebtBaseName(rawName: string, categoryName?: string | null): string {
	const raw = String(rawName ?? "").trim();
	if (!raw) return raw;

	let s = raw;
	const category = String(categoryName ?? "").trim();
	if (category) {
		const prefix = `${category}:`;
		if (s.toLowerCase().startsWith(prefix.toLowerCase())) {
			s = s.slice(prefix.length).trim();
		}
	}

	// Remove trailing auto-appended date tokens like "(2026-01)", "(2026-01 2026)", or "(2026-01 2026-01)".
	s = s.replace(/\s*\((\d{4}-\d{2})(?:\s+\d{4}(?:-\d{2})?)?\)\s*$/u, "").trim();

	// If the remaining label is ALL CAPS (common for categories like RENT), present it nicely.
	s = titleCaseIfAllCaps(s);

	return s || raw;
}

export function formatExpenseDebtCardTitle(debt: DebtCardDebt): string {
	const base = cleanExpenseDebtBaseName(
		(debt.sourceExpenseName ?? "").trim() || debt.name,
		debt.sourceCategoryName ?? null,
	);
	const monthLabel = formatYearMonthLabel(debt.sourceMonthKey);
	return monthLabel ? `${base} – ${monthLabel}` : base;
}
