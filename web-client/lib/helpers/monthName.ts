const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export function monthName(month1Based: number): string {
	const idx = Math.max(1, Math.min(12, Math.floor(month1Based))) - 1;
	return MONTH_NAMES[idx] ?? String(month1Based);
}
