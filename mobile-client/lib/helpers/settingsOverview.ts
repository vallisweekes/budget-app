import { Linking } from "react-native";
import Constants from "expo-constants";

import type { AppTranslationKey } from "@/lib/i18n";
import type { SettingsTab } from "@/types/settings";

export const SETTINGS_WEBSITE_URL = "https://budgetincheck.com";

export function getSettingsTabTitle(
  tab: Exclude<SettingsTab, "details">,
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): string {
  switch (tab) {
    case "personal":
      return "Personal details";
    case "budget":
      return t("settings.budgetTitle");
    case "preferences":
      return "App preferences";
    case "savings":
      return t("settings.moneyTitle");
    case "locale":
      return t("settings.localeCurrencyTitle");
    case "plans":
      return t("settings.plansTitle");
    case "subscription":
      return t("settings.subscriptionTitle");
    case "notifications":
      return t("settings.notificationsTitle");
    case "danger":
      return t("settings.dangerZoneTitle");
  }
}

export function getSettingsAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.5";
  return `v${version}`;
}

export async function openSettingsExternalUrl(url: string) {
  await Linking.openURL(url);
}