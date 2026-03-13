import type React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { Expense, ExpenseCategoryBreakdown } from "@/lib/apiTypes";
import type { PayFrequency } from "@/lib/payPeriods";
import type { ExpensesStackParamList } from "@/navigation/types";
import type { AddExpenseSheetAddedPayload } from "@/types/components/AddExpenseSheet.types";

export type CategoryExpensesScreenProps = NativeStackScreenProps<ExpensesStackParamList, "CategoryExpenses">;

export type CategoryExpensesSettingsSlice = {
  payDate: number | null;
  payFrequency: PayFrequency;
};

export type CategoryExpenseRowItem = Expense;

export type CategoryExpensesControllerState = {
  addSheetOpen: boolean;
  budgetPlanId: string | null;
  categoriesForAddSheet: ExpenseCategoryBreakdown[];
  categoryColor: string;
  categoryId: string;
  categoryName: string;
  color: string | null;
  currency: string;
  error: string | null;
  expenses: Expense[];
  heroPeriodLabel: string;
  loading: boolean;
  loggedPaymentsCount: number;
  logoFailed: Record<string, boolean>;
  month: number;
  monthPickerOpen: boolean;
  canAddExpenseInSelectedPeriod: boolean;
  openAddSheet: () => void;
  openMonthPicker: () => void;
  paidPct: number;
  paidTotal: number;
  pickerYear: number;
  pickerMonths: number[];
  plannedTotal: number;
  refreshing: boolean;
  remainingPct: number;
  remainingTotal: number;
  retry: () => void;
  routeIcon: string | null;
  setAddSheetOpen: (value: boolean) => void;
  setLogoFailed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setMonthPickerOpen: (value: boolean) => void;
  setPickerYear: React.Dispatch<React.SetStateAction<number>>;
  getPeriodOptionLabel: (targetMonth: number, targetYear: number) => string;
  topHeaderOffset: number;
  updatedLabel: string;
  year: number;
  onAddComplete: (payload: AddExpenseSheetAddedPayload) => void;
  onChangeMonth: (selectedMonth: number) => void;
  onRefresh: () => void;
  onPressExpense: (item: Expense) => void;
};
