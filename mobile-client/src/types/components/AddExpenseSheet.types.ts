import type { BudgetPlanListItem, ExpenseCategoryBreakdown } from "@/lib/apiTypes";

export interface AddExpenseSheetProps {
  visible: boolean;
  month: number;
  year: number;
  budgetPlanId?: string | null;
  initialCategoryId?: string;
  headerTitle?: string;
  plans?: BudgetPlanListItem[];
  currency: string;
  categories: ExpenseCategoryBreakdown[];
  onAdded: () => void;
  onClose: () => void;
}
