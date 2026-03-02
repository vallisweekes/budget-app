import { Dimensions } from "react-native";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import {
  BRAND_GREEN,
  SETTINGS_EMERGENCY_BORDER,
  SETTINGS_EMERGENCY_CARD_RED,
  SETTINGS_EMERGENCY_HINT,
  SETTINGS_EMERGENCY_ICON_BG,
  SETTINGS_EMERGENCY_TITLE,
  SETTINGS_EMERGENCY_VALUE,
  SETTINGS_INVESTMENT_BORDER,
  SETTINGS_INVESTMENT_CARD_BLUE,
  SETTINGS_INVESTMENT_HINT,
  SETTINGS_INVESTMENT_ICON_BG,
  SETTINGS_INVESTMENT_TITLE,
  SETTINGS_INVESTMENT_VALUE,
  SETTINGS_SAVINGS_BORDER,
  SETTINGS_SAVINGS_HINT,
  SETTINGS_SAVINGS_ICON_BG,
  SETTINGS_SAVINGS_TITLE,
  SETTINGS_SAVINGS_VALUE,
} from "@/lib/constants";
import type { SavingsField, SettingsTab } from "@/types/settings";

export const PRIMARY_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "budget", label: "Budget" },
  { id: "savings", label: "Money" },
  { id: "plans", label: "Plans" },
];

export const MORE_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "locale", label: "Locale" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger Zone" },
];

export const TAB_ICONS: Record<
  SettingsTab,
  {
    active: ComponentProps<typeof Ionicons>["name"];
    inactive: ComponentProps<typeof Ionicons>["name"];
  }
> = {
  details: { active: "person", inactive: "person-outline" },
  budget: { active: "wallet", inactive: "wallet-outline" },
  savings: { active: "cash", inactive: "cash-outline" },
  plans: { active: "list", inactive: "list-outline" },
  locale: { active: "globe", inactive: "globe-outline" },
  notifications: { active: "notifications", inactive: "notifications-outline" },
  danger: { active: "warning", inactive: "warning-outline" },
};

export const SAVINGS_TILE_SIZE = Math.min(122, Math.max(94, Math.floor(Dimensions.get("window").width * 0.3)));

export function getSavingsTilePalette(field: SavingsField): {
  cardBg: string;
  borderColor: string;
  iconBg: string;
  titleColor: string;
  valueColor: string;
  hintColor: string;
  plusColor: string;
} {
  if (field === "emergency") {
    return {
      cardBg: SETTINGS_EMERGENCY_CARD_RED,
      borderColor: SETTINGS_EMERGENCY_BORDER,
      iconBg: SETTINGS_EMERGENCY_ICON_BG,
      titleColor: SETTINGS_EMERGENCY_TITLE,
      valueColor: SETTINGS_EMERGENCY_VALUE,
      hintColor: SETTINGS_EMERGENCY_HINT,
      plusColor: SETTINGS_EMERGENCY_VALUE,
    };
  }
  if (field === "investment") {
    return {
      cardBg: SETTINGS_INVESTMENT_CARD_BLUE,
      borderColor: SETTINGS_INVESTMENT_BORDER,
      iconBg: SETTINGS_INVESTMENT_ICON_BG,
      titleColor: SETTINGS_INVESTMENT_TITLE,
      valueColor: SETTINGS_INVESTMENT_VALUE,
      hintColor: SETTINGS_INVESTMENT_HINT,
      plusColor: SETTINGS_INVESTMENT_VALUE,
    };
  }
  return {
    cardBg: BRAND_GREEN,
    borderColor: SETTINGS_SAVINGS_BORDER,
    iconBg: SETTINGS_SAVINGS_ICON_BG,
    titleColor: SETTINGS_SAVINGS_TITLE,
    valueColor: SETTINGS_SAVINGS_VALUE,
    hintColor: SETTINGS_SAVINGS_HINT,
    plusColor: SETTINGS_SAVINGS_VALUE,
  };
}

export function getAddPotLabel(field: SavingsField): string {
  if (field === "savings") return "Add Saving";
  if (field === "emergency") return "Add Emergency";
  return "Add Investment";
}
