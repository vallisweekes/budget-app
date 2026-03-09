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
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatGroupedNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function truncateTail(text: string, maxChars = 10): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}
