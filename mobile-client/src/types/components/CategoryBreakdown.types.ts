import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";

export interface CategoryBreakdownProps {
  categories: ExpenseCategoryBreakdown[];
  currency: string;
  fmt: (v: number, c: string) => string;
  onCategoryPress?: (cat: ExpenseCategoryBreakdown) => void;
  onAddPress?: () => void;
}
