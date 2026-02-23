import { T } from "@/lib/theme";

const CATEGORY_COLOR_HEX: Record<string, string> = {
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
  green: "#22c55e",
  indigo: "#6366f1",
  pink: "#ec4899",
  cyan: "#06b6d4",
  red: "#ef4444",
  emerald: "#10b981",
  teal: "#14b8a6",
  slate: "#64748b",
  amber: "#f59e0b",
};

const DEFAULT_COLOR = T.accent;

function normalizeHex(color: string): string | null {
  const value = color.trim();
  const short = /^#([\da-fA-F]{3})$/;
  const full = /^#([\da-fA-F]{6})$/;

  if (short.test(value)) {
    const [, raw] = short.exec(value) ?? [];
    if (!raw) return null;
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }

  if (full.test(value)) {
    return value.toLowerCase();
  }

  return null;
}

export function resolveCategoryColor(color: string | null | undefined, fallback: string = DEFAULT_COLOR): string {
  const safeFallback = normalizeHex(fallback) ?? DEFAULT_COLOR;
  if (!color) return safeFallback;

  const normalizedHex = normalizeHex(color);
  if (normalizedHex) return normalizedHex;

  const token = color.trim().toLowerCase();
  return CATEGORY_COLOR_HEX[token] ?? safeFallback;
}

export function withOpacity(color: string | null | undefined, opacity: number): string {
  const hex = resolveCategoryColor(color);
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${safeOpacity})`;
}
