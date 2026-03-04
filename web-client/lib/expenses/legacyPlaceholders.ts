export const LEGACY_PLACEHOLDER_EXPENSE_NAMES = new Set([
	"rent",
	"mortgage",
	"council tax",
	"counciltax",

	// Early app seed placeholders (generic / unscheduled)
	"emergency funds",
	"single saving",
	"home deposit",
	"monthly allowance",
]);

function normalizeExpenseName(name: unknown): string {
	const raw = typeof name === "string" ? name : "";
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^a-z\s]/g, "")
		.trim();
}

/**
 * Legacy placeholder expenses (early onboarding seeds) that should no longer
 * appear in pay-period views once users have real provider bills.
 */
export function isLegacyPlaceholderExpenseRow(row: {
	name?: unknown;
	dueDate?: unknown;
	isAllocation?: unknown;
	isMovedToDebt?: unknown;
	merchantDomain?: unknown;
	logoUrl?: unknown;
}): boolean {
	const name = normalizeExpenseName(row?.name);
	if (!name) return false;
	if (!LEGACY_PLACEHOLDER_EXPENSE_NAMES.has(name)) return false;

	// Only treat as a legacy placeholder when it has no explicit schedule.
	if (row?.dueDate) return false;
	if (row?.isAllocation) return false;
	if (row?.isMovedToDebt) return false;

	// Old placeholders were typically "generic" (no domain/logo).
	// Keep this as a heuristic; we still only filter for the exact names.
	const hasIdentity = Boolean(row?.merchantDomain) || Boolean(row?.logoUrl);
	if (hasIdentity) return false;

	return true;
}
