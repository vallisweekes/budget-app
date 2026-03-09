import type { Expense } from "@/lib/apiTypes";
import type { CurrencyFormatter } from "./BudgetDonutCard.types";

export interface ExpenseItemProps {
  expense: Expense;
  currency: string;
  fmt: CurrencyFormatter;
}
