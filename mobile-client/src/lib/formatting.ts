/** Shared currency / number formatting used across all screens */

export function fmt(
  val: number | string | null | undefined,
  currency = "£",
): string {
  const n =
    typeof val === "number" ? val : parseFloat(String(val ?? "0"));
  if (isNaN(n)) return `${currency}0.00`;
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency}${Math.abs(n).toLocaleString("en-US", {
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
