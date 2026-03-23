import type { Category, ExpenseCategoryBreakdown } from "@/lib/apiTypes";

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

export function findFallbackExpenseCategoryId(
  categories: Array<Pick<ExpenseCategoryBreakdown, "categoryId" | "name">>,
): string | null {
  const match = categories.find((category) => FALLBACK_CATEGORY_NAMES.has(normalizeCategoryName(category.name)));
  return match?.categoryId ?? null;
}
