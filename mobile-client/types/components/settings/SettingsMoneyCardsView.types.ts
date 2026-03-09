import type React from "react";
import { Ionicons } from "@expo/vector-icons";

import type { Debt } from "@/lib/apiTypes";
import type { DebtGroupKey } from "@/hooks";

export type SettingsMoneyCardsViewDebtGroup = {
  key: DebtGroupKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: Debt[];
};

export type SettingsMoneyCardsViewProps = {
  currency: string;
  creditCardGroups: SettingsMoneyCardsViewDebtGroup[];
  storeCardGroups: SettingsMoneyCardsViewDebtGroup[];
  onAddDebt: () => void;
  onOpenDebtEditor: (debt: Debt) => void;
};