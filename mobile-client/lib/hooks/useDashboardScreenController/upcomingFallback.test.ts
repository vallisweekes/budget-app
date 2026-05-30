import { describe, expect, it } from "vitest";

import type { DashboardData, Expense, Settings } from "@/lib/apiTypes";
import { buildDashboardDerived } from "@/components/DashboardScreen/derived";

import { buildFallbackUpcomingExpenses } from "./upcomingFallback";

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    name: "Internet",
    merchantDomain: null,
    logoUrl: null,
    logoSource: null,
    amount: "80",
    paid: false,
    paidAmount: "0",
    isAllocation: false,
    isDirectDebit: false,
    month: 5,
    year: 2026,
    categoryId: "cat-1",
    category: null,
    dueDate: "2026-05-18",
    lastPaymentAt: null,
    paymentSource: "income",
    cardDebtId: null,
    isExtraLoggedExpense: false,
    effectiveDueDate: "2026-05-18",
    inSelectedPayPeriod: true,
    ...overrides,
  };
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "settings-1",
    payDate: 15,
    payAnchorDate: null,
    payFrequency: "monthly",
    billFrequency: "monthly",
    monthlyAllowance: null,
    savingsBalance: null,
    emergencyBalance: null,
    investmentBalance: null,
    monthlySavingsContribution: null,
    monthlyEmergencyContribution: null,
    monthlyInvestmentContribution: null,
    budgetStrategy: null,
    budgetHorizonYears: null,
    incomeDistributeFullYearDefault: false,
    incomeDistributeHorizonDefault: false,
    homepageGoalIds: [],
    country: null,
    language: null,
    currency: "USD",
    accountCreatedAt: "2026-01-01T00:00:00.000Z",
    setupCompletedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    budgetPlanId: "plan-1",
    year: 2026,
    monthNum: 5,
    totalIncome: 3000,
    totalExpenses: 700,
    remaining: 2300,
    totalAllocations: 0,
    plannedDebtPayments: 0,
    plannedSavingsContribution: 0,
    plannedEmergencyContribution: 0,
    plannedInvestments: 0,
    incomeAfterAllocations: 3000,
    categoryData: [],
    goals: [],
    homepageGoalIds: [],
    debts: [],
    totalDebtBalance: 0,
    expenseInsights: {
      recap: null,
      upcoming: [],
      recapTips: [],
    },
    allPlansData: {},
    largestExpensesByPlan: {},
    incomeMonthsCoverageByPlan: {},
    payDate: 15,
    payFrequency: "monthly",
    billFrequency: "monthly",
    payPeriodLabel: "May 15 - Jun 14",
    previousPayPeriodLabel: "Apr 15 - May 14",
    ...overrides,
  };
}

describe("buildFallbackUpcomingExpenses", () => {
  it("keeps individual expense rows, prefers effective due dates, excludes fully paid rows, and sorts deterministically", () => {
    const now = new Date("2026-05-15T12:00:00.000Z");
    const items = buildFallbackUpcomingExpenses([
      createExpense({
        id: "streaming",
        name: "Streaming",
        amount: "25",
        paidAmount: "25",
        dueDate: "2026-05-17",
        effectiveDueDate: "2026-05-17",
      }),
      createExpense({
        id: "rent",
        name: "Rent",
        amount: "1200",
        paidAmount: "100",
        dueDate: "2026-05-20",
        effectiveDueDate: "2026-05-16",
      }),
      createExpense({
        id: "wifi",
        name: "WiFi",
        amount: "80",
        paidAmount: "0",
        dueDate: "2026-05-18",
        effectiveDueDate: "2026-05-18",
      }),
      createExpense({
        id: "phone",
        name: "Phone",
        amount: "80",
        paidAmount: "0",
        dueDate: "2026-05-18",
        effectiveDueDate: "2026-05-18",
      }),
    ], now);

    expect(items.map((item) => item.id)).toEqual(["rent", "phone", "wifi"]);
    expect(items.map((item) => item.name)).toEqual(["Rent", "Phone", "WiFi"]);
    expect(items[0]).toMatchObject({
      dueDate: "2026-05-16",
      daysUntilDue: 1,
      urgency: "soon",
    });
    expect(items.find((item) => item.id === "streaming")).toBeUndefined();
  });
});

describe("buildDashboardDerived", () => {
  it("uses enriched upcoming expense rows when the dashboard payload already provides them", () => {
    const derived = buildDashboardDerived({
      dashboard: createDashboard({
        categoryData: [
          {
            id: "housing",
            name: "Housing",
            total: 1200,
            expenses: [
              {
                id: "category-rent",
                name: "Housing",
                logoUrl: "/logos/housing.png",
                amount: 1200,
                paid: false,
                paidAmount: 0,
                categoryId: "housing",
              },
            ],
          },
        ],
        expenseInsights: {
          recap: null,
          recapTips: [],
          upcoming: [
            {
              id: "expense-rent",
              kind: "expense",
              name: "Rent",
              amount: 1200,
              paidAmount: 0,
              status: "unpaid",
              dueDate: "2026-05-16",
              daysUntilDue: 1,
              urgency: "soon",
            },
          ],
        },
      }),
      settings: createSettings(),
      categorySheet: null,
      displayedAnchor: { month: 5, year: 2026 },
    });

    expect(derived.upcoming).toHaveLength(1);
    expect(derived.upcoming[0]).toMatchObject({
      id: "expense-rent",
      name: "Rent",
      dueDate: "2026-05-16",
      daysUntilDue: 1,
    });
    expect(derived.upcoming[0]?.name).not.toBe("Housing");
  });

  it("preserves expense logo urls when the dashboard falls back to category expenses", () => {
    const derived = buildDashboardDerived({
      dashboard: createDashboard({
        categoryData: [
          {
            id: "phone",
            name: "Phone",
            total: 98,
            expenses: [
              {
                id: "expense-ee",
                name: "EE",
                logoUrl: "/logos/ee.png",
                amount: 98,
                paid: false,
                paidAmount: 0,
                categoryId: "phone",
              },
            ],
          },
        ],
        expenseInsights: {
          recap: null,
          recapTips: [],
          upcoming: [],
        },
      }),
      settings: createSettings(),
      categorySheet: null,
      displayedAnchor: { month: 5, year: 2026 },
    });

    expect(derived.upcoming).toHaveLength(1);
    expect(derived.upcoming[0]).toMatchObject({
      id: "expense-ee",
      name: "EE",
      logoUrl: "/logos/ee.png",
    });
  });
});