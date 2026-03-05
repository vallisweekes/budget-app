export function canonicalizeIncomeName(name: unknown): string {
  const normalized = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.toLowerCase() === "salary") return "Salary";
  return normalized;
}
