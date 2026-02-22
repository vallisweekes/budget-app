import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/* ── Income stack (inside Income tab) ──────────────────────── */
export type IncomeStackParamList = {
  IncomeGrid: { year?: number } | undefined;
  IncomeMonth: { month: number; year: number; budgetPlanId: string };
};

/* ── Debt stack (inside Debts tab) ─────────────────────────── */
export type DebtStackParamList = {
  DebtList: undefined;
  DebtDetail: { debtId: string; debtName: string };
};

/* ── Tab navigator ─────────────────────────────────────────── */
export type MainTabParamList = {
  Dashboard: undefined;
  Income: NavigatorScreenParams<IncomeStackParamList> | undefined;
  Expenses: undefined;
  Debts: NavigatorScreenParams<DebtStackParamList> | undefined;
  Settings: undefined;
};

/* ── Root stack ─────────────────────────────────────────────── */
export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

/* ── Typed screen props helpers ─────────────────────────────── */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
