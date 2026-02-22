import { formatCurrency } from "@/lib/helpers/money";

export function formatCurrencyCompact(value: number): string {
	try {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
			notation: "compact",
			compactDisplay: "short",
			maximumFractionDigits: 0,
			minimumFractionDigits: 0,
		}).format(Math.round(value));
	} catch {
		return formatCurrency(Math.round(value));
	}
}

export function formatCurrencyWhole(value: number): string {
	try {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "GBP",
			maximumFractionDigits: 0,
			minimumFractionDigits: 0,
		}).format(Math.round(value));
	} catch {
		return formatCurrency(Math.round(value));
	}
}
