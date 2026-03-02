import type { Animated } from "react-native";

import type { Debt } from "@/lib/apiTypes";
import type { DebtGroupKey } from "@/lib/hooks/useSettingsDebtBuckets";
import type { MoneyViewMode, SavingsField, SavingsPot } from "@/types/settings";

export type SettingsMoneyTabDebtGroup = {
  key: DebtGroupKey;
  label: string;
  icon: "card-outline" | "albums-outline";
  items: Debt[];
};

export type SettingsMoneyTabSavingsCard = {
  key: SavingsField;
  title: string;
  icon: "wallet-outline" | "shield-checkmark-outline" | "trending-up-outline";
  total: number;
  base: number;
  monthly: number;
};

export type SettingsMoneyTabProps = {
  mode: MoneyViewMode;
  toggleTranslateX: Animated.AnimatedInterpolation<string | number>;
  tileSize: number;
  currency: string;
  savingsCards: SettingsMoneyTabSavingsCard[];
  savingsPotsByField: Record<SavingsField, SavingsPot[]>;
  creditCardGroups: SettingsMoneyTabDebtGroup[];
  storeCardGroups: SettingsMoneyTabDebtGroup[];
  asMoneyText: (value: number) => string;
  getAddPotLabel: (field: SavingsField) => string;
  getSavingsTilePalette: (field: SavingsField) => {
    cardBg: string;
    borderColor: string;
    iconBg: string;
    titleColor: string;
    valueColor: string;
    hintColor: string;
    plusColor: string;
  };
  onChangeMode: (mode: MoneyViewMode) => void;
  onOpenSavingsEditor: (field: SavingsField, potId?: string) => void;
  onOpenSavingsField: (field: SavingsField) => void;
  onAddDebt: () => void;
  onOpenDebtEditor: (debt: Debt) => void;
};
