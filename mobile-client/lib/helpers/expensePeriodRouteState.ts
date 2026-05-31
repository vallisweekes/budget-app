import { registerSessionScopedResetter } from "@/lib/sessionScopedState";

export type ExpensePeriodAnchor = {
  month: number;
  year: number;
};

type ExpensePeriodRouteParams = {
  month?: unknown;
  year?: unknown;
  currentPeriodMonth?: unknown;
  currentPeriodYear?: unknown;
  budgetPlanId?: unknown;
  currency?: unknown;
};

type SharedExpensePeriodRouteState = {
  selectedAnchor: ExpensePeriodAnchor | null;
  currentAnchor: ExpensePeriodAnchor | null;
  budgetPlanId: string | null;
  currency: string | null;
};

let sharedExpensePeriodRouteState: SharedExpensePeriodRouteState = {
  selectedAnchor: null,
  currentAnchor: null,
  budgetPlanId: null,
  currency: null,
};

function parseAnchor(monthValue: unknown, yearValue: unknown): ExpensePeriodAnchor | null {
  const month = Number(monthValue);
  const year = Number(yearValue);

  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
    return null;
  }

  return {
    month: Math.floor(month),
    year: Math.floor(year),
  };
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return trimmed;
}

function buildResolvedState(state: SharedExpensePeriodRouteState) {
  return {
    ...state,
    displayedAnchor: state.selectedAnchor ?? state.currentAnchor,
  };
}

export function setSharedExpensePeriodRouteState(state: SharedExpensePeriodRouteState): void {
  sharedExpensePeriodRouteState = {
    selectedAnchor: state.selectedAnchor,
    currentAnchor: state.currentAnchor,
    budgetPlanId: state.budgetPlanId,
    currency: state.currency,
  };
}

export function getSharedExpensePeriodRouteState() {
  return buildResolvedState(sharedExpensePeriodRouteState);
}

export function resolveExpensePeriodRouteState(
  params?: ExpensePeriodRouteParams | null,
  options?: { fallbackToShared?: boolean },
): {
  selectedAnchor: ExpensePeriodAnchor | null;
  currentAnchor: ExpensePeriodAnchor | null;
  displayedAnchor: ExpensePeriodAnchor | null;
  budgetPlanId: string | null;
  currency: string | null;
} {
  const shared = options?.fallbackToShared ? sharedExpensePeriodRouteState : null;
  const selectedAnchor = parseAnchor(params?.month, params?.year) ?? shared?.selectedAnchor ?? null;
  const currentAnchor = parseAnchor(params?.currentPeriodMonth, params?.currentPeriodYear) ?? shared?.currentAnchor ?? null;
  const budgetPlanId = parseString(params?.budgetPlanId) ?? shared?.budgetPlanId ?? null;
  const currency = parseString(params?.currency) ?? shared?.currency ?? null;

  return buildResolvedState({
    selectedAnchor,
    currentAnchor,
    budgetPlanId,
    currency,
  });
}

registerSessionScopedResetter(() => {
  sharedExpensePeriodRouteState = {
    selectedAnchor: null,
    currentAnchor: null,
    budgetPlanId: null,
    currency: null,
  };
});