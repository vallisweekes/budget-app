import type React from "react";
import { Ionicons } from "@expo/vector-icons";

import type { SavingsField, SavingsPot } from "@/types/settings";

export type SettingsMoneyPersonalViewSavingsCard = {
  key: SavingsField;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  total: number;
  base: number;
  monthly: number;
};

export type SettingsMoneyPersonalViewProps = {
  currency: string;
  tileSize: number;
  savingsCards: SettingsMoneyPersonalViewSavingsCard[];
  savingsPotsByField: Record<SavingsField, SavingsPot[]>;
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
  onOpenSavingsEditor: (field: SavingsField, potId?: string) => void;
  onOpenSavingsField: (field: SavingsField) => void;
};
