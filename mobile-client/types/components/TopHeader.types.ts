import type { ReactNode } from "react";

export interface TopHeaderProps {
  onSettings: () => void;
  onIncome: () => void;
  onAnalytics: () => void;
  onHelp?: () => void;
  onNotifications: () => void;
  variant?: "default" | "analytics";
  leftContent?: ReactNode;
  leftVariant?: "avatar" | "back";
  onBack?: () => void;
  centerLabel?: string;
  centerContent?: ReactNode;
  showIncomeAction?: boolean;
  rightContent?: ReactNode;
  compactActionsMenu?: boolean;
  showHelpAction?: boolean;
  showAnalyticsAction?: boolean;
  showNotificationAction?: boolean;
  onLogout?: () => void;
  incomePendingCount?: number;
  onAddIncome?: () => void;
  showNotificationDot?: boolean;
}
