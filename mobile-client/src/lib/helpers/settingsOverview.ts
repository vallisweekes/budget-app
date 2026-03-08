import { Linking } from "react-native";
import Constants from "expo-constants";

import type { SettingsTab } from "@/types/settings";

export const SETTINGS_WEBSITE_URL = "https://budgetincheck.com";

export const SETTINGS_TAB_TITLES: Record<Exclude<SettingsTab, "details">, string> = {
  budget: "Budget",
  savings: "Money",
  locale: "Locale & Currency",
  plans: "Plans",
  notifications: "Notifications",
  danger: "Danger Zone",
};

export function getSettingsAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.5";
  return `v${version}`;
}

export async function openSettingsExternalUrl(url: string) {
  await Linking.openURL(url);
}