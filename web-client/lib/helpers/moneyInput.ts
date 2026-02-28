import { DEFAULT_CURRENCY_CODE } from "@/lib/constants/money";
import { buildLocale, DEFAULT_COUNTRY, DEFAULT_LANGUAGE, getCurrencySymbol } from "@/lib/constants/locales";

export function sanitizeMoneyDraft(text: string): string {
  const raw = String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");

  const sign = raw.startsWith("-") ? "-" : "";
  const withoutSign = raw.replace(/\-/g, "");

  const parts = withoutSign.split(".");
  const intPart = (parts[0] ?? "").replace(/^0+(?=\d)/, "0");
  const decPart = parts.length > 1 ? (parts.slice(1).join("") ?? "") : "";
  return sign + intPart + (parts.length > 1 ? "." + decPart : "");
}

export function parseMoney(text: string): number | null {
  const cleaned = sanitizeMoneyDraft(text);
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatNumberPart(
  value: number,
  opts?: { currency?: string; locale?: string; language?: string; country?: string }
): { symbol: string; number: string } {
  const currency = opts?.currency ?? DEFAULT_CURRENCY_CODE;
  const locale =
    opts?.locale ?? buildLocale(opts?.language ?? DEFAULT_LANGUAGE, opts?.country ?? DEFAULT_COUNTRY);

  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Keep symbol separate from number so inputs can render as prefix.
  const parts = fmt.formatToParts(value);
  const symbol =
    parts.find((p) => p.type === "currency")?.value ?? getCurrencySymbol(currency);
  const number = parts
    .filter((p) => p.type !== "currency")
    .map((p) => p.value)
    .join("")
    .trim();

  return { symbol, number };
}
