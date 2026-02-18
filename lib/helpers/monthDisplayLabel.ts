import type { MonthKey } from "@/types";
import { formatMonthKeyLabel } from "@/lib/helpers/monthKey";

export function monthDisplayLabel(month: MonthKey): string {
	const raw = formatMonthKeyLabel(month).trim();
	return raw.length ? raw[0] + raw.slice(1).toLowerCase() : raw;
}
