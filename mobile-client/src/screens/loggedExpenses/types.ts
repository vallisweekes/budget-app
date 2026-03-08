import type { Expense } from "@/lib/apiTypes";

export type LoggedExpensesControllerState = {
  categoryColor: string;
  categoryId?: string | null;
  categoryName?: string;
  color: string | null;
  currency: string;
  error: string | null;
  items: Expense[];
  loading: boolean;
  month: number;
  onPressItem: (item: Expense) => void;
  onRefresh: () => void;
  periodLabel: string;
  refreshing: boolean;
  retry: () => void;
  screenKicker: string;
  topHeaderOffset: number;
  total: number;
  year: number;
};
