import React from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { useBootstrapData } from "@/context/BootstrapDataContext";
import { useAppTranslation } from "@/lib/hooks/useAppTranslation";
import { normalizeSupportedLanguage, resolveDefaultLanguageForCountry } from "@/lib/constants";
import { hasPositiveDebtBalance, isDebtManagementEnabled } from "@/lib/helpers/debtManagement";
import { useGetDebtSummaryQuery } from "@/store/api";
import type { SettingsMainContentProps } from "@/types/components/settings/SettingsMainContent.types";

type Args = Pick<SettingsMainContentProps, "controller" | "navigation">;

export function useSettingsMainContentViewModel({ controller, navigation }: Args) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const router = useRouter();
  const { dashboard } = useBootstrapData();
  const { t } = useAppTranslation(controller.settings?.language);
  const debtSummaryQuery = useGetDebtSummaryQuery(undefined, { refetchOnMountOrArgChange: true });

  const openIncomeSettings = React.useCallback(() => {
    router.push("/settings-income-settings");
  }, [router]);

  const openDebtManagement = React.useCallback(() => {
    router.push("/settings-debt-management");
  }, [router]);

  const openProfileDetails = React.useCallback(() => {
    router.push({
      pathname: "/settings-profile-details",
      params: {
        username: controller.profile?.username ?? controller.authUsername ?? "",
        email: controller.profile?.email ?? "",
        emailVerificationStatus: controller.profile?.emailVerificationStatus ?? "not_required",
        emailVerificationDeadlineAt: controller.profile?.emailVerificationDeadlineAt ?? null,
      },
    });
  }, [controller.authUsername, controller.profile?.email, controller.profile?.emailVerificationDeadlineAt, controller.profile?.emailVerificationStatus, controller.profile?.username, router]);

  const hasDashboardDebts = React.useMemo(() => {
    if (debtSummaryQuery.isSuccess) {
      return (debtSummaryQuery.data?.activeCount ?? 0) > 0;
    }

    return hasPositiveDebtBalance(dashboard?.debts);
  }, [dashboard?.debts, debtSummaryQuery.data?.activeCount, debtSummaryQuery.isSuccess]);

  const debtManagementEnabled = isDebtManagementEnabled({
    hasActualDebts: hasDashboardDebts,
    hasConfiguredDebts: controller.hasAnyDebts,
    onboardingHasDebtsToManage: controller.profile?.onboarding?.profile?.hasDebtsToManage,
    profileHasDebtsToManage: controller.profile?.onboarding?.profile?.hasDebtsToManage,
  });

  const handleUseDetectedCountry = React.useCallback(() => {
    if (!controller.detectedCountry || !controller.settings?.id) return;
    if ((controller.settings.country ?? "").toUpperCase() === controller.detectedCountry) return;

    const currentCountry = (controller.settings.country ?? "").toUpperCase();
    const currentDefaultLanguage = resolveDefaultLanguageForCountry(currentCountry);
    const currentLanguage = normalizeSupportedLanguage(
      controller.settings?.language ?? controller.languageDraft,
      currentDefaultLanguage,
    );
    const nextLanguage = currentLanguage === currentDefaultLanguage
      ? resolveDefaultLanguageForCountry(controller.detectedCountry)
      : currentLanguage;

    controller.setCountryDraft(controller.detectedCountry);
    void controller.saveLocale(controller.detectedCountry, nextLanguage);
  }, [controller]);

  const handleRefresh = React.useCallback(() => {
    controller.setRefreshing(true);
    controller.load();
  }, [controller]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [controller.activeTab]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return unsubscribe;
  }, [navigation]);

  return {
    debtManagementEnabled,
    handleRefresh,
    handleUseDetectedCountry,
    openDebtManagement,
    openIncomeSettings,
    openProfileDetails,
    router,
    scrollRef,
    t,
  };
}
