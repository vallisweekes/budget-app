import type { DashboardCategoryItem } from "@/lib/apiTypes";
import type { CurrencyFormatter } from "./BudgetDonutCard.types";

export interface CategorySpendingChartProps {
  categories: DashboardCategoryItem[];
  currency: string;
  fmt: CurrencyFormatter;
}
