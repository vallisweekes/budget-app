/**
 * Shared helpers for expense logic (no server actions)
 */

const NON_DEBT_CATEGORY_NAMES = new Set(
	[
		"food and dining",
		"food & dining",
		"food",
		"dining",
		"transport",
		"travel",
		"transport / travel",
		"transport/travel",
	].map((s) => s.toLowerCase())
);

/**
 * Check if a category name should never create debts (allocations)
 */
export function isNonDebtCategoryName(name: string | null | undefined): boolean {
	const normalized = String(name ?? "").trim().toLowerCase();
	if (!normalized) return false;
	if (NON_DEBT_CATEGORY_NAMES.has(normalized)) return true;
	if (normalized.includes("food") && normalized.includes("dining")) return true;
	if (normalized.includes("transport") || normalized.includes("travel")) return true;
	return false;
}
