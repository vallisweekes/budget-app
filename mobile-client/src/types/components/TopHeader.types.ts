import type { ReactNode } from "react";

export interface TopHeaderProps {
  onSettings: () => void;
  onIncome: () => void;
  onAnalytics: () => void;
  onNotifications: () => void;
  leftContent?: ReactNode;
  leftVariant?: "avatar" | "back";
  onBack?: () => void;
  centerLabel?: string;
  centerContent?: ReactNode;
  showIncomeAction?: boolean;
  rightContent?: ReactNode;
  compactActionsMenu?: boolean;
  onLogout?: () => void;
  incomePendingCount?: number;
  onAddIncome?: () => void;
  showNotificationDot?: boolean;
}
