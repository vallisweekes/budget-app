/** Shared currency / number formatting used across all screens */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
  ZAR: "R",
  AUD: "$",
  CAD: "$",
  NZD: "$",
};

export function currencySymbol(currency: string | null | undefined): string {
  const raw = String(currency ?? "").trim();
  if (!raw) return "£";

  const upper = raw.toUpperCase();
  if (CURRENCY_SYMBOLS[upper]) return CURRENCY_SYMBOLS[upper]!;

  // If the app already stores a symbol (e.g. £ $ €), keep it.
  if (raw.length <= 2) return raw;

  // Fall back to the provided string.
  return raw;
}

export function fmt(
  val: number | string | null | undefined,
  currency = "£",
): string {
  const sym = currencySymbol(currency);
  const n =
    typeof val === "number" ? val : parseFloat(String(val ?? "0"));
  if (isNaN(n)) return `${sym}0.00`;
  const sign = n < 0 ? "-" : "";
  return `${sign}${sym}${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

export const MONTH_NAMES_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

export function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}
