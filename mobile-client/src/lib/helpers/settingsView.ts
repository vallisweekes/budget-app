import { Dimensions } from "react-native";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { BRAND_GREEN } from "@/lib/constants";
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

const EMERGENCY_CARD_RED = "#FF9E96";
const INVESTMENT_CARD_BLUE = "#9EC9FF";

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
      cardBg: EMERGENCY_CARD_RED,
      borderColor: "rgba(86,19,22,0.17)",
      iconBg: "rgba(86,19,22,0.15)",
      titleColor: "#5a1316",
      valueColor: "#3f0d11",
      hintColor: "#7a262c",
      plusColor: "#3f0d11",
    };
  }
  if (field === "investment") {
    return {
      cardBg: INVESTMENT_CARD_BLUE,
      borderColor: "rgba(17,45,82,0.18)",
      iconBg: "rgba(17,45,82,0.13)",
      titleColor: "#1b3f6d",
      valueColor: "#122c4b",
      hintColor: "#295a96",
      plusColor: "#122c4b",
    };
  }
  return {
    cardBg: BRAND_GREEN,
    borderColor: "rgba(11,46,62,0.16)",
    iconBg: "rgba(8,44,66,0.16)",
    titleColor: "#0b2e3e",
    valueColor: "#071f34",
    hintColor: "#123e56",
    plusColor: "#071f34",
  };
}

export function getAddPotLabel(field: SavingsField): string {
  if (field === "savings") return "Add Saving";
  if (field === "emergency") return "Add Emergency";
  return "Add Investment";
}
