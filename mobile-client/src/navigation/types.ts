import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/* ── Income stack (inside Income tab) ──────────────────────── */
export type IncomeStackParamList = {
  IncomeGrid: { year?: number } | undefined;
  IncomeMonth: { month: number; year: number; budgetPlanId: string };
};

/* ── Expenses stack (inside Expenses tab) ───────────────────── */
export type ExpensesStackParamList = {
  ExpensesList: undefined;
  CategoryExpenses: {
    categoryId: string;
    categoryName: string;
    color: string | null;
    icon: string | null;
    month: number;
    year: number;
    budgetPlanId: string | null;
    currency: string;
  };
};

/* ── Debt stack (inside Debts tab) ─────────────────────────── */
export type DebtStackParamList = {
  DebtList: undefined;
  DebtDetail: { debtId: string; debtName: string };
  DebtAnalytics: {
    debts: import("@/lib/apiTypes").DebtSummaryItem[];
    totalMonthly: number;
    currency: string;
  };
};

/* ── Tab navigator ─────────────────────────────────────────── */
export type MainTabParamList = {
  Dashboard: undefined;
  Income: NavigatorScreenParams<IncomeStackParamList> | undefined;
  Expenses: NavigatorScreenParams<ExpensesStackParamList> | undefined;
  Debts: NavigatorScreenParams<DebtStackParamList> | undefined;
  Settings: undefined;
};

/* ── Root stack ─────────────────────────────────────────────── */
export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Payments: undefined;
  Goals: undefined;
  GoalsProjection: undefined;
};

/* ── Typed screen props helpers ─────────────────────────────── */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ExpensesStackScreenProps<T extends keyof ExpensesStackParamList> =
  NativeStackScreenProps<ExpensesStackParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
