import type { MonthKey } from "@/types";

const MONTH_KEY_TO_NUMBER: Record<MonthKey, number> = {
	JANUARY: 1,
	FEBURARY: 2,
	MARCH: 3,
	APRIL: 4,
	MAY: 5,
	JUNE: 6,
	JULY: 7,
	"AUGUST ": 8,
	SEPTEMBER: 9,
	OCTOBER: 10,
	NOVEMBER: 11,
	DECEMBER: 12,
};

const NUMBER_TO_MONTH_KEY: Record<number, MonthKey> = {
	1: "JANUARY",
	2: "FEBURARY",
	3: "MARCH",
	4: "APRIL",
	5: "MAY",
	6: "JUNE",
	7: "JULY",
	8: "AUGUST ",
	9: "SEPTEMBER",
	10: "OCTOBER",
	11: "NOVEMBER",
	12: "DECEMBER",
};

export function monthKeyToNumber(month: MonthKey): number {
	return MONTH_KEY_TO_NUMBER[month];
}

export function monthNumberToKey(monthNumber: number): MonthKey {
	const key = NUMBER_TO_MONTH_KEY[monthNumber];
	if (!key) throw new Error(`Invalid month number: ${monthNumber}`);
	return key;
}

export function normalizeMonthKey(value: string): MonthKey | null {
	const raw = String(value ?? "").trim();
	if (!raw) return null;

	// Canonicalize common variants.
	if (raw === "AUGUST") return "AUGUST ";
	if (raw === "FEBRUARY") return "FEBURARY";

	const candidate = raw === "AUGUST" ? "AUGUST " : raw;
	if (candidate in MONTH_KEY_TO_NUMBER) return candidate as MonthKey;
	return null;
}

export function tryMonthNumberFromKey(value: string): number | null {
	const normalized = normalizeMonthKey(value);
	if (!normalized) return null;
	return monthKeyToNumber(normalized);
}

export function formatMonthKeyLabel(month: MonthKey): string {
	const trimmed = String(month).trim();
	if (trimmed === "FEBURARY") return "February";
	if (trimmed === "JANUARY") return "January";
	if (trimmed === "MARCH") return "March";
	if (trimmed === "APRIL") return "April";
	if (trimmed === "MAY") return "May";
	if (trimmed === "JUNE") return "June";
	if (trimmed === "JULY") return "July";
	if (trimmed === "AUGUST") return "August";
	if (trimmed === "SEPTEMBER") return "September";
	if (trimmed === "OCTOBER") return "October";
	if (trimmed === "NOVEMBER") return "November";
	if (trimmed === "DECEMBER") return "December";
	return trimmed ? trimmed[0] + trimmed.slice(1).toLowerCase() : trimmed;
}

export function formatMonthKeyShortLabel(month: MonthKey): string {
	return formatMonthKeyLabel(month).slice(0, 3);
}

export function currentMonthKey(date: Date = new Date()): MonthKey {
	// JS Date.getMonth(): 0-11
	const monthNumber = date.getMonth() + 1;
	return monthNumberToKey(monthNumber);
}
