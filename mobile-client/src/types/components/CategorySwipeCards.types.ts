import type { DashboardCategoryItem } from "@/lib/apiTypes";
import type { CurrencyFormatter } from "./BudgetDonutCard.types";

export interface CategorySwipeCardsPressPayload {
  id: string;
  name: string;
}

export interface CategorySwipeCardsProps {
  categories: DashboardCategoryItem[];
  totalIncome: number;
  currency: string;
  fmt: CurrencyFormatter;
  onPressCategory?: (category: CategorySwipeCardsPressPayload) => void;
}
