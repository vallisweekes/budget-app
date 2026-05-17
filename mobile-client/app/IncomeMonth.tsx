import React from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";

import IncomeMonthScreen from "@/components/IncomeMonthScreen";

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

  const route = {
    key: "StandaloneIncomeMonth",
    name: "IncomeMonth",
    params: {
      month: getNumberParam(params.month, new Date().getMonth() + 1),
      year: getNumberParam(params.year, new Date().getFullYear()),
      budgetPlanId: getStringParam(params.budgetPlanId) ?? "",
      initialMode: (getStringParam(params.initialMode) === "income" ? "income" : "sacrifice") as "income" | "sacrifice",
      pendingConfirmationsCount: getNumberParam(params.pendingConfirmationsCount, 0),
      showPendingNotice: getStringParam(params.showPendingNotice) === "true",
      openIncomeAddAt: undefined,
      standaloneSacrifice: true,
    },
  };

  return <IncomeMonthScreen navigation={navigation as any} route={route as any} />;
}