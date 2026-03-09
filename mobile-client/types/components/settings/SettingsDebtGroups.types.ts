import type React from "react";
import { Ionicons } from "@expo/vector-icons";

import type { Debt } from "@/lib/apiTypes";
import type { DebtGroupKey } from "@/hooks";

export type SettingsDebtGroupsGroup = {
  key: DebtGroupKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: Debt[];
};

export type SettingsDebtGroupsProps = {
  groupedDebts: SettingsDebtGroupsGroup[];
  currency: string;
  asMoneyInput: (value: string | null | undefined) => string;
  onOpenDebtEditor: (debt: Debt) => void;
};