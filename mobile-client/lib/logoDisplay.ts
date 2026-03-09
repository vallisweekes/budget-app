import { getApiBaseUrl } from "@/lib/api";

export function resolveLogoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  try {
    return `${getApiBaseUrl()}${raw}`;
  } catch {
    return null;
  }
}

const GENERIC_TERMS = new Set([
  "work",
  "travel",
  "barber",
  "barbers",
  "rent",
  "housing",
  "utilities",
  "childcare",
  "groceries",
  "grocery",
  "food",
  "fuel",
  "transport",
  "allowance",
  "savings",
  "emergency",
  "income",
  "debt",
  "payment",
  "loan",
  "mortgage",
]);

function tokenizeName(name: string): string[] {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Heuristic to decide whether we should display a fetched logo instead of a
 * letter avatar. We keep this conservative to avoid showing incorrect logos
 * for generic expense names (e.g. "Rent").
 */
export function shouldShowExpenseLogo(params: {
  name: string;
  logoUrl?: string | null;
  merchantDomain?: string | null;
}): boolean {
  const cleaned = String(params.name ?? "").trim().toLowerCase();
  if (!cleaned) return false;
  if (!params.logoUrl) return false;

  // Always allow explicit static logos.
  if (typeof params.logoUrl === "string" && params.logoUrl.startsWith("/logos/")) return true;

  // If the expense has a merchant domain, we trust the logo.
  if (typeof params.merchantDomain === "string" && params.merchantDomain.trim()) return true;

  const tokens = tokenizeName(cleaned);
  if (tokens.length === 0) return false;

  // Allow UK housing association-style names like "Southern Housing".
  // These often include the generic token "housing" but are still specific.
  if (tokens.includes("housing") && tokens.length <= 5) {
    const distinctive = tokens.some((t) => t.length >= 4 && !GENERIC_TERMS.has(t));
    if (distinctive) return true;
  }

  // Default: only show logos for short, specific names without generic terms.
  if (tokens.length > 2) return false;
  if (tokens.some((t) => GENERIC_TERMS.has(t))) return false;
  return /[a-z]/i.test(cleaned);
}
