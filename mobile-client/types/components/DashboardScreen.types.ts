import type { Animated, GestureResponderHandlers } from "react-native";

import type { MainTabScreenProps } from "@/navigation/types";
import type { Settings } from "@/lib/apiTypes";

export type DashboardScreenProps = MainTabScreenProps<"Dashboard">;

export type DashboardTip = {
  title: string;
  detail: string;
  priority?: number;
};

export type CategorySheetExpense = {
  id: string;
  name: string;
  amount: number;
  paid?: boolean;
  paidAmount?: number | null;
};

export type CategorySheetProps = {
  visible: boolean;
  categoryName: string;
  expenses: CategorySheetExpense[];
  currency: string;
  dragY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onClose: () => void;
};

export type GoalCard = {
  goal: {
    id: string;
    title: string;
    targetAmount?: number | null;
    currentAmount?: number | null;
    type?: string | null;
    category?: string | null;
  };
};

export type DashboardGoalsSectionProps = {
  items: GoalCard[];
  settings: Settings | null;
  currency: string;
  activeGoalCard: number;
  onMomentumEnd: (offsetX: number) => void;
  onPressGoals: () => void;
  onPressAddGoal: () => void;
  onPressProjection: () => void;
};

export type DashboardRecap = {
  paidCount?: number;
  paidAmount?: number;
  missedDueCount?: number;
  missedDueAmount?: number;
};

export type DashboardRecapSectionProps = {
  recap: DashboardRecap | null;
  hasRecapData: boolean;
  recapTitle: string;
  currency: string;
};

export type UpcomingDebt = {
  id: string;
  name: string;
  dueAmount?: number | null;
  logoUrl?: string | null;
};

export type DashboardUpcomingDebtsSectionProps = {
  items: UpcomingDebt[];
  currency: string;
  isLogoFailed: (key: string) => boolean;
  onLogoError: (key: string) => void;
  onOpenQuickPay: (debt: UpcomingDebt) => void;
  onSeeAll: () => void;
};

export type UpcomingExpense = {
  id: string;
  name: string;
  amount: number;
  paidAmount?: number | null;
  dueDate?: string | null;
  logoUrl?: string | null;
  urgency?: string;
  daysUntilDue: number;
};

export type DashboardUpcomingExpensesSectionProps = {
  items: UpcomingExpense[];
  currency: string;
  formatShortDate: (iso: string | null | undefined) => string | null;
  isLogoFailed: (key: string) => boolean;
  onLogoError: (key: string) => void;
  onOpenQuickPay: (expense: UpcomingExpense) => void;
  onSeeAll: () => void;
};