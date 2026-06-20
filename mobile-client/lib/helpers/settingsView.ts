import { Dimensions } from "react-native";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import type { AppTranslationKey } from "@/lib/i18n";
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

export function getPrimaryTabs(t: (key: AppTranslationKey, params?: Record<string, string | number>) => string): Array<{ id: SettingsTab; label: string }> {
  return [
    { id: "details", label: t("settings.detailsTitle") },
    { id: "budget", label: t("settings.budgetTitle") },
    { id: "savings", label: t("settings.moneyTitle") },
    { id: "plans", label: t("settings.plansTitle") },
  ];
}

export function getMoreTabs(t: (key: AppTranslationKey, params?: Record<string, string | number>) => string): Array<{ id: SettingsTab; label: string }> {
  return [
    { id: "locale", label: t("settings.localeCurrencyTitle") },
    { id: "notifications", label: t("settings.notificationsTitle") },
    { id: "subscription", label: t("settings.subscriptionTitle") },
    { id: "danger", label: t("settings.dangerZoneTitle") },
  ];
}

export const TAB_ICONS: Record<
  SettingsTab,
  {
    active: ComponentProps<typeof Ionicons>["name"];
    inactive: ComponentProps<typeof Ionicons>["name"];
  }
> = {
  details: { active: "person", inactive: "person-outline" },
  personal: { active: "person-circle", inactive: "person-circle-outline" },
  budget: { active: "wallet", inactive: "wallet-outline" },
  preferences: { active: "options", inactive: "options-outline" },
  savings: { active: "cash", inactive: "cash-outline" },
  plans: { active: "list", inactive: "list-outline" },
  locale: { active: "globe", inactive: "globe-outline" },
  notifications: { active: "notifications", inactive: "notifications-outline" },
  subscription: { active: "card", inactive: "card-outline" },
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

export function getAddPotLabel(
  field: SavingsField,
  t?: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (!t) {
    if (field === "savings") return "Add Saving";
    if (field === "emergency") return "Add Emergency";
    return "Add Investment";
  }

  if (field === "savings") return t("settings.money.addSavings");
  if (field === "emergency") return t("settings.money.addEmergency");
  return t("settings.money.addInvestment");
}
