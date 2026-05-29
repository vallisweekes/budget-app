/** Shared currency / number formatting used across all screens */

import { MONTH_NAMES_LONG, MONTH_NAMES_SHORT } from "@/lib/constants";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "$",
  TTD: "$",
  NGN: "₦",
  ZAR: "R",
  AUD: "$",
  NZD: "$",
  CHF: "CHF",
  INR: "₹",
  JPY: "¥",
  SGD: "$",
};

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "£": "GBP",
  "$": "USD",
  "€": "EUR",
  "₦": "NGN",
  R: "ZAR",
  "₹": "INR",
  "¥": "JPY",
};

const CURRENCY_FORMAT_LOCALES: Record<string, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "de-DE",
  CAD: "en-CA",
  TTD: "en-TT",
  NGN: "en-NG",
  ZAR: "en-ZA",
  AUD: "en-AU",
  NZD: "en-NZ",
  CHF: "de-CH",
  INR: "en-IN",
  JPY: "ja-JP",
  SGD: "en-SG",
};

export function normalizeCurrencyCode(currency: string | null | undefined): string {
  const raw = String(currency ?? "").trim();
  if (!raw) return "GBP";

  if (SYMBOL_TO_CURRENCY[raw]) return SYMBOL_TO_CURRENCY[raw]!;

  const upper = raw.toUpperCase();
  if (CURRENCY_SYMBOLS[upper]) return upper;
  return upper;
}

export function resolveCurrencyFormattingLocale(currency: string | null | undefined): string {
  const normalized = normalizeCurrencyCode(currency);
  return CURRENCY_FORMAT_LOCALES[normalized] ?? "en-GB";
}

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
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const n =
    typeof val === "number" ? val : parseFloat(String(val ?? "0"));
  if (isNaN(n)) return fmt(0, currency);

  try {
    return new Intl.NumberFormat(resolveCurrencyFormattingLocale(normalizedCurrency), {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    const sym = currencySymbol(currency);
    const sign = n < 0 ? "-" : "";
    return `${sign}${sym}${Math.abs(n).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export { MONTH_NAMES_SHORT, MONTH_NAMES_LONG };

export function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}

function titleCaseIfAllCaps(value: string): string {
  const s = String(value ?? "").trim();
  if (!s) return s;
  if (!/[A-Za-z]/.test(s)) return s;
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Normalizes auto-generated payment/debt names for display.
 * - Strips trailing date suffixes like "(2026-01)".
 * - Title-cases segments that are ALL CAPS.
 * - Preserves category prefixes like "Housing: RENT" -> "Housing: Rent".
 */
export function normalizeUpcomingName(rawName: string): string {
  let s = String(rawName ?? "").trim();
  if (!s) return s;

  // Remove trailing auto-appended date tokens like "(2026-01)", "(2026-01 2026)", or "(2026-01 2026-01)".
  // Also handles full ISO dates like "(2026-01-15)" or longer variants like "(2026-01-15 2026-02-15)".
  s = s.replace(/\s*\((?:\d{4}-\d{2})(?:-\d{2})?[^)]*\)\s*$/u, "").trim();

  // Remove any legacy debt suffix if present.
  s = s.replace(/\s*\(Debt\)\s*$/i, "").trim();

  // If there's a category prefix (e.g. "Housing: RENT"), title-case ALL CAPS parts on each side.
  if (s.includes(":")) {
    const idx = s.indexOf(":");
    const left = s.slice(0, idx).trim();
    const right = s.slice(idx + 1).trim();
    const leftNice = titleCaseIfAllCaps(left);
    const rightNice = titleCaseIfAllCaps(right);
    return rightNice ? `${leftNice}: ${rightNice}` : leftNice;
  }

  return titleCaseIfAllCaps(s);
}
