import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { Expense } from "@/lib/apiTypes";
import type { ExpensesStackParamList } from "@/navigation/types";

export type LoggedExpensesScreenProps = NativeStackScreenProps<ExpensesStackParamList, "LoggedExpenses">;

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
