import type { Expense } from "@/lib/apiTypes";

export type LoggedExpenseCardCategoryIconProps = {
  color: string;
  name: string | null | undefined;
};

export type LoggedExpenseCardProps = {
  categoryColor: string;
  categoryName?: string;
  currency: string;
  deleting?: boolean;
  item: Expense;
  onDelete: (item: Expense) => void;
  onPress: (item: Expense) => void;
};