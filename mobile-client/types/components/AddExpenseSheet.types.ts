import type { BudgetPlanListItem, Expense, ExpenseCategoryBreakdown } from "@/lib/apiTypes";

export type AddExpenseSheetAddedPayload = {
  phase: "optimistic" | "confirmed" | "revert";
  expense?: Expense;
  optimisticId?: string;
};

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
  onAdded: (payload: AddExpenseSheetAddedPayload) => void;
  onClose: () => void;
}
