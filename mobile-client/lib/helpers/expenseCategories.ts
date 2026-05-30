import type { Category, ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import { getExpenseCategoryBreakdownsForPlanKind } from "@/lib/constants";

const FALLBACK_CATEGORY_NAMES = new Set(["other", "miscellaneous", "miscellaneous & other", "misc"]);

function normalizeCategoryName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase();
}

export function toExpenseCategoryBreakdowns(categories: Category[]): ExpenseCategoryBreakdown[] {
  return categories.map((category) => ({
    categoryId: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    total: 0,
    paidTotal: 0,
    paidCount: 0,
    totalCount: 0,
  }));
}

export function getPlanExpenseCategoryBreakdowns(kind: string | null | undefined): ExpenseCategoryBreakdown[] {
  return getExpenseCategoryBreakdownsForPlanKind(kind);
}

export function findExpenseCategoryIdByName(
  categories: Array<Pick<ExpenseCategoryBreakdown, "categoryId" | "name">>,
  name: string | null | undefined,
): string | null {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) return null;
  const match = categories.find((category) => normalizeCategoryName(category.name) === normalizedName);
  return match?.categoryId ?? null;
}

export function findFallbackExpenseCategoryId(
  categories: Array<Pick<ExpenseCategoryBreakdown, "categoryId" | "name">>,
): string | null {
  const match = categories.find((category) => FALLBACK_CATEGORY_NAMES.has(normalizeCategoryName(category.name)));
  return match?.categoryId ?? null;
}
