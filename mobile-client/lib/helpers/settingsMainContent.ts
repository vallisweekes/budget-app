import type { AppTranslationKey } from "@/lib/i18n";
import { T } from "@/lib/theme";

type Translate = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

type ProfileEmailStatus = {
  emailVerificationStatus?: "verified" | "pending" | "missing_email" | "not_required" | string;
} | null | undefined;

export function formatSettingsPayFrequency(value: unknown, t: Translate): string {
  if (value === "weekly") return t("settings.payFrequency.weekly");
  if (value === "every_2_weeks") return t("settings.payFrequency.every2Weeks");
  if (value === "every_4_weeks") return t("settings.payFrequency.every4Weeks");
  return t("settings.payFrequency.monthly");
}

export function getVerificationLabel(profile: ProfileEmailStatus, t: Translate): string {
  if (!profile) return t("common.unavailable");
  if (profile.emailVerificationStatus === "verified") return t("settings.status.verified");
  if (profile.emailVerificationStatus === "pending") return t("settings.status.pending");
  if (profile.emailVerificationStatus === "missing_email") return t("settings.status.addEmail");
  return t("settings.status.notRequired");
}

export function getVerificationColor(profile: ProfileEmailStatus): string | undefined {
  if (!profile) return undefined;
  if (profile.emailVerificationStatus === "verified") return T.green;
  if (profile.emailVerificationStatus === "pending") return T.orange;
  if (profile.emailVerificationStatus === "missing_email") return T.red;
  return undefined;
}

export function shouldShowSettingsSubpageHeader(activeTab: string): boolean {
  return ![
    "details",
    "subscription",
    "budget",
    "savings",
    "plans",
    "locale",
    "notifications",
  ].includes(activeTab);
}
