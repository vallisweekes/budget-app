import type { Expense } from "@/lib/apiTypes";

export type CategoryExpenseCardProps = {
  categoryColor: string;
  currency: string;
  expense: Expense;
  logoFailed: boolean;
  onLogoError: (expenseId: string) => void;
  onPress: (expense: Expense) => void;
};