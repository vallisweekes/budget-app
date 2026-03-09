import type { Expense } from "@/lib/apiTypes";

export type LoggedExpenseCardCategoryIconProps = {
  color: string;
  name: string | null | undefined;
};

export type LoggedExpenseCardProps = {
  categoryColor: string;
  categoryName?: string;
  currency: string;
  item: Expense;
  onPress: (item: Expense) => void;
};