import { DEFAULT_CURRENCY_CODE } from "@/lib/constants/money";

export function formatCurrency(value: number, currency: string = DEFAULT_CURRENCY_CODE, locale?: string): string {
	return value.toLocaleString(locale, { style: "currency", currency });
}
