import React from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import IncomeMonthScreen from "@/components/IncomeMonthScreen";
import { useActiveBudgetPlan } from "@/context/ActiveBudgetPlanContext";
import { useAuth } from "@/context/AuthContext";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { resolveDisplayedPayPeriodAnchor } from "@/lib/helpers/resolveDisplayedPayPeriodAnchor";
import { normalizePayFrequency } from "@/lib/payPeriods";
import { T } from "@/lib/theme";

type LocalParam = string | string[] | undefined;

function getStringParam(value: LocalParam): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function getNumberParam(value: LocalParam, fallback: number): number {
  const parsed = Number(getStringParam(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function StandaloneIncomeMonthRoute() {
  const navigation = useNavigation();
  const params = useLocalSearchParams() as Record<string, LocalParam>;
  const { profile } = useAuth();
  const { activeBudgetPlanId } = useActiveBudgetPlan();
  const { settings, ensureLoaded } = useBootstrapData();
  const explicitMonth = getNumberParam(params.month, Number.NaN);
  const explicitYear = getNumberParam(params.year, Number.NaN);
  const routeBudgetPlanId = getStringParam(params.budgetPlanId) ?? "";
  const availablePlanIds = React.useMemo(
    () => new Set((profile?.plans ?? []).map((plan) => plan.id)),
    [profile?.plans],
  );
  const explicitBudgetPlanId = availablePlanIds.has(routeBudgetPlanId) ? routeBudgetPlanId : "";
  const hasExplicitMonth = Number.isFinite(explicitMonth) && explicitMonth >= 1 && explicitMonth <= 12;
  const hasExplicitYear = Number.isFinite(explicitYear) && explicitYear >= 1900;
  const hasExplicitAnchor = hasExplicitMonth && hasExplicitYear;
  const resolvedBudgetPlanId = explicitBudgetPlanId || activeBudgetPlanId || settings?.id || "";
  const [resolvedAnchor, setResolvedAnchor] = React.useState<{ month: number; year: number } | null>(
    hasExplicitAnchor && resolvedBudgetPlanId
      ? { month: Math.floor(explicitMonth), year: Math.floor(explicitYear) }
      : null,
  );

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const bootstrap = settings ? { settings } : await ensureLoaded();
      const resolvedSettings = bootstrap.settings;
      const budgetPlanId = explicitBudgetPlanId || activeBudgetPlanId || resolvedSettings?.id || "";
      if (!budgetPlanId) return;

      if (hasExplicitAnchor) {
        if (!cancelled) {
          setResolvedAnchor({ month: Math.floor(explicitMonth), year: Math.floor(explicitYear) });
        }
        return;
      }

      const payFrequency = normalizePayFrequency(resolvedSettings?.payFrequency);
      const nextAnchor = await resolveDisplayedPayPeriodAnchor({
        budgetPlanId,
        payDate: resolvedSettings?.payDate ?? 27,
        payAnchorDate: resolvedSettings?.payAnchorDate ?? null,
        payFrequency,
        planCreatedAt: resolvedSettings?.setupCompletedAt
          ? new Date(resolvedSettings.setupCompletedAt)
          : resolvedSettings?.accountCreatedAt
            ? new Date(resolvedSettings.accountCreatedAt)
            : null,
      });

      if (!cancelled) {
        setResolvedAnchor(nextAnchor);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeBudgetPlanId, ensureLoaded, explicitBudgetPlanId, explicitMonth, explicitYear, hasExplicitAnchor, settings]);

  if (!resolvedAnchor || !resolvedBudgetPlanId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.accent} />
      </View>
    );
  }

  const route = {
    key: "StandaloneIncomeMonth",
    name: "IncomeMonth",
    params: {
      month: resolvedAnchor.month,
      year: resolvedAnchor.year,
      budgetPlanId: resolvedBudgetPlanId,
      initialMode: (getStringParam(params.initialMode) === "income" ? "income" : "sacrifice") as "income" | "sacrifice",
      pendingConfirmationsCount: getNumberParam(params.pendingConfirmationsCount, 0),
      showPendingNotice: getStringParam(params.showPendingNotice) === "true",
      openIncomeAddAt: undefined,
      standaloneSacrifice: true,
    },
  };

  return <IncomeMonthScreen navigation={navigation as any} route={route as any} />;
}