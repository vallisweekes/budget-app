import { createNavigationContainerRef } from "@react-navigation/native";

import type { RootStackParamList } from "@/navigation/types";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type IncomeSacrificeReminderPayload = {
  month?: unknown;
  year?: unknown;
  budgetPlanId?: unknown;
};

function parseMonth(raw: unknown): number | null {
  const month = Number(raw);
  if (!Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return Math.floor(month);
}

function parseYear(raw: unknown): number | null {
  const year = Number(raw);
  if (!Number.isFinite(year)) return null;
  if (year < 2000 || year > 2200) return null;
  return Math.floor(year);
}

function parseBudgetPlanId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function openIncomeSacrificeFromReminder(payload: IncomeSacrificeReminderPayload): boolean {
  const month = parseMonth(payload.month);
  const year = parseYear(payload.year);
  const budgetPlanId = parseBudgetPlanId(payload.budgetPlanId);

  if (!navigationRef.isReady()) return false;

  if (month && year && budgetPlanId) {
    navigationRef.navigate("IncomeFlow", {
      screen: "IncomeMonth",
      params: {
        month,
        year,
        budgetPlanId,
        initialMode: "sacrifice",
      },
    });
    return true;
  }

  if (year) {
    navigationRef.navigate("IncomeFlow", {
      screen: "IncomeGrid",
      params: { year },
    });
    return true;
  }

  navigationRef.navigate("IncomeFlow");
  return true;
}
