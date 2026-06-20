import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { ApiError, apiFetch } from "@/lib/api";
import type {
  BudgetPlanListItem,
  BudgetPlansResponse,
  Category,
  CreditCard,
  DashboardData,
  Debt,
  DebtPayment,
  DebtSummaryData,
  Expense,
  ExpenseSummary,
  Goal,
  Income,
  IncomeMonthData,
  IncomeSacrificeData,
  IncomeSummaryData,
  OnboardingProfile,
  OnboardingStatusResponse,
  ReceiptConfirmBody,
  ReceiptScanResponse,
  Settings,
  SubscriptionSummaryResponse,
  UserProfile,
} from "@/lib/apiTypes";
import type { CreateSacrificeItemResponse } from "@/types/settings";

export type MobileApiError = {
  name: string;
  message: string;
  status: number;
  code: string | null;
  detail: string | null;
};

function normalizeApiError(err: unknown): MobileApiError {
  if (err instanceof ApiError) {
    return {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code,
      detail: err.detail,
    };
  }

  return {
    name: err instanceof Error && err.name ? err.name : "ApiError",
    message: err instanceof Error ? err.message : "Request failed",
    status: 500,
    code: "UNKNOWN_ERROR",
    detail: null,
  };
}

export function getMobileApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export const mobileApi = createApi({
  reducerPath: "mobileApi",
  baseQuery: fakeBaseQuery<MobileApiError>(),
  tagTypes: ["Dashboard", "Settings", "Subscription", "UserProfile", "BudgetPlans", "Debts", "CreditCards", "Onboarding", "Categories", "Goals", "Expenses", "IncomeSacrifice"],
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardData, void>({
      async queryFn() {
        try {
          const data = await apiFetch<DashboardData>("/api/bff/dashboard", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Dashboard"],
    }),
    getDashboardByPeriod: builder.query<DashboardData, {
      budgetPlanId: string;
      month: number;
      year: number;
    }>({
      async queryFn({ budgetPlanId, month, year }) {
        try {
          const data = await apiFetch<DashboardData>(
            `/api/bff/dashboard?budgetPlanId=${encodeURIComponent(budgetPlanId)}&month=${month}&year=${year}`,
            { cacheTtlMs: 0 },
          );
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      keepUnusedDataFor: 120,
      providesTags: ["Dashboard"],
    }),
    getSettings: builder.query<Settings, void>({
      async queryFn() {
        try {
          const data = await apiFetch<Settings>("/api/bff/settings", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Settings"],
    }),
    getPlanSettings: builder.query<Settings, string>({
      async queryFn(budgetPlanId) {
        try {
          const data = await apiFetch<Settings>(`/api/bff/settings?budgetPlanId=${encodeURIComponent(budgetPlanId)}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Settings"],
    }),
    getBudgetPlans: builder.query<BudgetPlansResponse, void>({
      async queryFn() {
        try {
          const data = await apiFetch<BudgetPlansResponse>("/api/bff/budget-plans", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["BudgetPlans"],
    }),
    getCategories: builder.query<Category[], { budgetPlanId?: string | null } | void>({
      async queryFn(arg) {
        try {
          const budgetPlanId = arg && typeof arg === "object" ? arg.budgetPlanId : null;
          const planQp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const data = await apiFetch<Category[]>(`/api/bff/categories${planQp}`, { cacheTtlMs: 4_000 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Categories"],
    }),
    getDebts: builder.query<Debt[], { budgetPlanId?: string | null } | void>({
      async queryFn(arg) {
        try {
          const budgetPlanId = arg && typeof arg === "object" ? arg.budgetPlanId : null;
          const planQp = budgetPlanId ? `?budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const data = await apiFetch<Debt[]>(`/api/bff/debts${planQp}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Debts"],
    }),
    getOnboardingStatus: builder.query<OnboardingStatusResponse, void>({
      async queryFn() {
        try {
          const data = await apiFetch<OnboardingStatusResponse>("/api/bff/onboarding", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Onboarding"],
    }),
    getPlanDebts: builder.query<Debt[], string>({
      async queryFn(budgetPlanId) {
        try {
          const data = await apiFetch<Debt[]>(`/api/bff/debts?budgetPlanId=${encodeURIComponent(budgetPlanId)}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Debts"],
    }),
    getDebtSummary: builder.query<DebtSummaryData, void>({
      async queryFn() {
        try {
          const data = await apiFetch<DebtSummaryData>("/api/bff/debt-summary", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Debts"],
    }),
    getIncomeSummary: builder.query<IncomeSummaryData, number>({
      async queryFn(year) {
        try {
          const data = await apiFetch<IncomeSummaryData>(`/api/bff/income-summary?year=${year}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Dashboard"],
    }),
    getExpenseSummary: builder.query<ExpenseSummary, {
      month: number;
      year: number;
      budgetPlanId?: string | null;
      scope?: "month" | "pay_period";
      includeBudgetOverview?: boolean;
    }>({
      async queryFn({ month, year, budgetPlanId, scope = "pay_period", includeBudgetOverview = false }) {
        try {
          const planQp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const budgetOverviewQp = includeBudgetOverview ? "&includeBudgetOverview=1" : "";
          const data = await apiFetch<ExpenseSummary>(
            `/api/bff/expenses/summary?month=${month}&year=${year}&scope=${scope}${planQp}${budgetOverviewQp}`,
            { cacheTtlMs: includeBudgetOverview ? 15_000 : 0 },
          );
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Dashboard"],
    }),
    getExpenses: builder.query<Expense[], {
      month: number;
      year: number;
      budgetPlanId?: string | null;
      scope?: "month" | "pay_period";
    }>({
      async queryFn({ month, year, budgetPlanId, scope = "pay_period" }) {
        try {
          const planQp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const data = await apiFetch<Expense[]>(
            `/api/bff/expenses?month=${month}&year=${year}&scope=${scope}${planQp}`,
            { cacheTtlMs: 0 },
          );
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      keepUnusedDataFor: 120,
      providesTags: ["Expenses"],
    }),
    getAnalyticsExpenseSeries: builder.query<number[], {
      year: number;
      budgetPlanId?: string | null;
    }>({
      async queryFn({ year, budgetPlanId }) {
        try {
          const planQp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const overview = await apiFetch<{ months?: Array<{ monthIndex: number; expenseTotal: number }> }>(
            `/api/bff/analytics/overview?year=${year}${planQp}`,
            { cacheTtlMs: 10_000 },
          );
          const series = Array.from({ length: 12 }, (_, idx) => {
            const monthIndex = idx + 1;
            const month = overview?.months?.find((entry) => entry.monthIndex === monthIndex);
            return month?.expenseTotal ?? 0;
          });
          return { data: series };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Dashboard"],
    }),
    getIncomeMonth: builder.query<IncomeMonthData, {
      budgetPlanId: string;
      month: number;
      year: number;
      mode?: "full" | "home_core";
    }>({
      async queryFn({ budgetPlanId, month, year, mode = "full" }) {
        try {
          const data = await apiFetch<IncomeMonthData>(
            `/api/bff/income-month?month=${month}&year=${year}&budgetPlanId=${encodeURIComponent(budgetPlanId)}&mode=${encodeURIComponent(mode)}`,
            { cacheTtlMs: 0 },
          );
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      keepUnusedDataFor: 120,
      providesTags: ["Dashboard"],
    }),
    getDebtDetail: builder.query<Debt, string>({
      async queryFn(debtId) {
        try {
          const data = await apiFetch<Debt>(`/api/bff/debts/${encodeURIComponent(debtId)}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Debts"],
    }),
    getGoal: builder.query<Goal, string>({
      async queryFn(goalId) {
        try {
          const data = await apiFetch<Goal>(`/api/bff/goals/${encodeURIComponent(goalId)}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: (_result, _error, goalId) => [{ type: "Goals", id: goalId }],
    }),
    getGoals: builder.query<Goal[], { budgetPlanId: string }>({
      async queryFn({ budgetPlanId }) {
        try {
          const data = await apiFetch<Goal[]>(`/api/bff/goals?budgetPlanId=${encodeURIComponent(budgetPlanId)}`, {
            cacheTtlMs: 15_000,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      keepUnusedDataFor: 120,
      providesTags: (result) => result
        ? [
            ...result.map((goal) => ({ type: "Goals" as const, id: goal.id })),
            { type: "Goals" as const, id: "LIST" },
          ]
        : [{ type: "Goals" as const, id: "LIST" }],
    }),
    getDebtPayments: builder.query<DebtPayment[], string>({
      async queryFn(debtId) {
        try {
          const data = await apiFetch<DebtPayment[]>(`/api/bff/debts/${encodeURIComponent(debtId)}/payments`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Debts"],
    }),
    getCreditCards: builder.query<CreditCard[], void>({
      async queryFn() {
        try {
          const data = await apiFetch<CreditCard[]>("/api/bff/credit-cards", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["CreditCards"],
    }),
    getSubscription: builder.query<SubscriptionSummaryResponse, void>({
      async queryFn() {
        try {
          const data = await apiFetch<SubscriptionSummaryResponse>("/api/bff/subscription", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Subscription"],
    }),
    createDebt: builder.mutation<Debt, {
      budgetPlanId: string;
      name: string;
      type: string;
      initialBalance: number;
      currentBalance: number;
      amount: number;
      interestRate: number | null;
      creditLimit: number | null;
      dueDate?: string | null;
      dueDay?: number | null;
      installmentMonths?: number | null;
      defaultPaymentSource?: "income" | "extra_funds" | "credit_card";
      defaultPaymentCardDebtId?: string | null;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Debt>("/api/bff/debts", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Debts", "Dashboard", "CreditCards"],
    }),
    createIncome: builder.mutation<Income, {
      name: string;
      amount: number;
      month: number;
      year: number;
      budgetPlanId: string;
      distributeMonths?: boolean;
      distributeYears?: boolean;
      distributeFullYear?: boolean;
      distributeHorizon?: boolean;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Income>("/api/bff/income", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard"],
    }),
    updateIncome: builder.mutation<Income, { id: string; changes: { name?: string; amount?: number } }>({
      async queryFn({ id, changes }) {
        try {
          const data = await apiFetch<Income>(`/api/bff/income/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: changes,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard"],
    }),
    deleteIncome: builder.mutation<{ success?: boolean }, { id: string }>({
      async queryFn({ id }) {
        try {
          const data = await apiFetch<{ success?: boolean }>(`/api/bff/income/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard"],
    }),
    createExpense: builder.mutation<Expense, Record<string, unknown>>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Expense>("/api/bff/expenses", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Settings", "Debts", "CreditCards", "Expenses", "Goals", "IncomeSacrifice"],
    }),
    updateExpense: builder.mutation<Expense, { id: string; changes: Record<string, unknown> }>({
      async queryFn({ id, changes }) {
        try {
          const data = await apiFetch<Expense>(`/api/bff/expenses/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: changes,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Debts", "CreditCards", "Expenses"],
    }),
    deleteExpense: builder.mutation<{ success?: boolean }, { id: string; scope?: "single" | "future" }>({
      async queryFn({ id, scope }) {
        try {
          const query = scope ? `?scope=${encodeURIComponent(scope)}` : "";
          const data = await apiFetch<{ success?: boolean }>(`/api/bff/expenses/${encodeURIComponent(id)}${query}`, {
            method: "DELETE",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Debts", "CreditCards", "Expenses"],
    }),
    updateDebt: builder.mutation<Debt, { id: string; changes: Record<string, unknown> }>({
      async queryFn({ id, changes }) {
        try {
          const data = await apiFetch<Debt>(`/api/bff/debts/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: changes,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Debts", "Dashboard", "CreditCards"],
    }),
    deleteDebt: builder.mutation<{ success: true }, { id: string }>({
      async queryFn({ id }) {
        try {
          const data = await apiFetch<{ success: true }>(`/api/bff/debts/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Debts", "Dashboard", "CreditCards"],
    }),
    createDebtPayment: builder.mutation<DebtPayment, {
      debtId: string;
      amount: number;
      source?: "income" | "extra_funds" | "credit_card";
      cardDebtId?: string;
      paidAt?: string;
      notes?: string;
    }>({
      async queryFn({ debtId, ...body }) {
        try {
          const data = await apiFetch<DebtPayment>(`/api/bff/debts/${encodeURIComponent(debtId)}/payments`, {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Debts", "Dashboard", "CreditCards"],
    }),
    deleteDebtPayment: builder.mutation<{ success: true }, {
      debtId: string;
      paymentId: string;
    }>({
      async queryFn({ debtId, paymentId }) {
        try {
          const data = await apiFetch<{ success: true }>(
            `/api/bff/debts/${encodeURIComponent(debtId)}/payments/${encodeURIComponent(paymentId)}`,
            {
              method: "DELETE",
            },
          );
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Debts", "Dashboard", "CreditCards"],
    }),
    updateProfile: builder.mutation<UserProfile, { email?: string | null; avatarImageDataUrl?: string | null }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<UserProfile>("/api/bff/me", {
            method: "PATCH",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["UserProfile"],
    }),
    resendEmailVerification: builder.mutation<{
      ok: boolean;
      status: "verified" | "pending" | "missing_email" | "not_required";
      deadlineAt: string | null;
      required: boolean;
      blocked: boolean;
    }, void>({
      async queryFn() {
        try {
          const data = await apiFetch<{
            ok: boolean;
            status: "verified" | "pending" | "missing_email" | "not_required";
            deadlineAt: string | null;
            required: boolean;
            blocked: boolean;
          }>("/api/bff/email-verification/resend", {
            method: "POST",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["UserProfile"],
    }),
    updateOnboardingProfile: builder.mutation<{ ok?: boolean; profile?: OnboardingProfile }, Partial<OnboardingProfile>>({
      async queryFn(body) {
        try {
          const data = await apiFetch<{ ok?: boolean; profile?: OnboardingProfile }>("/api/bff/onboarding", {
            method: "PATCH",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Onboarding", "Dashboard", "Settings", "UserProfile"],
    }),
    completeOnboarding: builder.mutation<Record<string, unknown>, void>({
      async queryFn() {
        try {
          const data = await apiFetch<Record<string, unknown>>("/api/bff/onboarding", {
            method: "POST",
            timeoutMs: 60_000,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Onboarding", "Dashboard", "Settings", "BudgetPlans", "UserProfile"],
    }),
    updateSettings: builder.mutation<Settings, { budgetPlanId: string; changes: Record<string, unknown> }>({
      async queryFn({ budgetPlanId, changes }) {
        try {
          const data = await apiFetch<Settings>("/api/bff/settings", {
            method: "PATCH",
            body: {
              budgetPlanId,
              ...changes,
            },
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Settings", "Dashboard"],
    }),
    createGoal: builder.mutation<Goal, {
      budgetPlanId: string;
      title: string;
      targetAmount?: number;
      currentAmount?: number;
      targetYear?: number | null;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Goal>("/api/bff/goals", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Settings", { type: "Goals", id: "LIST" }],
    }),
    updateGoal: builder.mutation<Goal, { id: string; changes: Record<string, unknown> }>({
      async queryFn({ id, changes }) {
        try {
          const data = await apiFetch<Goal>(`/api/bff/goals/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: changes,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: (_result, _error, { id }) => ["Dashboard", "Settings", { type: "Goals", id }, { type: "Goals", id: "LIST" }],
    }),
    deleteGoal: builder.mutation<{ success?: boolean }, { id: string }>({
      async queryFn({ id }) {
        try {
          const data = await apiFetch<{ success?: boolean }>(`/api/bff/goals/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: (_result, _error, { id }) => ["Dashboard", "Settings", { type: "Goals", id }, { type: "Goals", id: "LIST" }],
    }),
    createIncomeSacrificeCustom: builder.mutation<CreateSacrificeItemResponse, {
      budgetPlanId: string;
      type: string;
      name: string;
      amount: number;
      month: number;
      year: number;
      createGoal?: boolean;
      goalTargetAmount?: number;
      goalTargetYear?: number;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<CreateSacrificeItemResponse>("/api/bff/income-sacrifice/custom", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Settings", "Dashboard", "Goals", "IncomeSacrifice"],
    }),
    deleteIncomeSacrificeCustom: builder.mutation<{ success?: boolean }, { id: string }>({
      async queryFn({ id }) {
        try {
          const data = await apiFetch<{ success?: boolean }>(`/api/bff/income-sacrifice/custom/${encodeURIComponent(id)}`, {
            method: "DELETE",
            body: {},
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Settings", "Dashboard", "Goals", "IncomeSacrifice"],
    }),
    updateIncomeSacrifice: builder.mutation<Record<string, unknown>, {
      budgetPlanId: string;
      month?: number;
      year?: number;
      fixed?: IncomeSacrificeData["fixed"];
      customAmountById?: Record<string, number>;
      targets?: Array<{ month: number; year: number }>;
      fixedFieldUpdate?: {
        field: "monthlyAllowance" | "monthlySavingsContribution" | "monthlyEmergencyContribution" | "monthlyInvestmentContribution";
        amount: number;
      };
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Record<string, unknown>>("/api/bff/income-sacrifice", {
            method: "PATCH",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Goals", "IncomeSacrifice"],
    }),
    updateIncomeSacrificeGoalLink: builder.mutation<Record<string, unknown>, {
      budgetPlanId: string;
      targetKey: string;
      goalId: string | null;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Record<string, unknown>>("/api/bff/income-sacrifice/goals", {
            method: "PATCH",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Goals", "IncomeSacrifice"],
    }),
    confirmIncomeSacrificeGoalTransfer: builder.mutation<Record<string, unknown>, {
      budgetPlanId: string;
      month: number;
      year: number;
      targetKey: string;
    }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<Record<string, unknown>>("/api/bff/income-sacrifice/goals", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Goals", "IncomeSacrifice"],
    }),
    scanReceipt: builder.mutation<ReceiptScanResponse, { image: string }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<ReceiptScanResponse>("/api/bff/receipts/scan", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
    }),
    confirmReceipt: builder.mutation<Record<string, unknown>, { receiptId: string; body: ReceiptConfirmBody }>({
      async queryFn({ receiptId, body }) {
        try {
          const data = await apiFetch<Record<string, unknown>>(`/api/bff/receipts/${encodeURIComponent(receiptId)}/confirm`, {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["Dashboard", "Debts", "CreditCards", "Expenses"],
    }),
    createBudgetPlan: builder.mutation<BudgetPlanListItem, { kind: string; name: string; eventDate?: string; includePostEventIncome?: boolean }>({
      async queryFn(body) {
        try {
          const data = await apiFetch<BudgetPlanListItem>("/api/bff/budget-plans", {
            method: "POST",
            body,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["BudgetPlans", "Settings", "Dashboard"],
    }),
    updateBudgetPlan: builder.mutation<BudgetPlanListItem, { id: string; changes: { payDate?: number; budgetHorizonYears?: number; name?: string; eventDate?: string; includePostEventIncome?: boolean } }>({
      async queryFn({ id, changes }) {
        try {
          const data = await apiFetch<BudgetPlanListItem>(`/api/bff/budget-plans/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: changes,
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["BudgetPlans", "Settings", "Dashboard"],
    }),
    deleteBudgetPlan: builder.mutation<{ success: true }, { id: string }>({
      async queryFn({ id }) {
        try {
          const data = await apiFetch<{ success: true }>(`/api/bff/budget-plans/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["BudgetPlans", "Settings", "Dashboard"],
    }),
    resetAccountData: builder.mutation<{ ok: boolean }, void>({
      async queryFn() {
        try {
          const data = await apiFetch<{ ok: boolean }>("/api/bff/account/reset-data", {
            method: "POST",
          });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      invalidatesTags: ["BudgetPlans", "Settings", "Dashboard", "Subscription", "UserProfile"],
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetDashboardByPeriodQuery,
  useGetCategoriesQuery,
  useGetDebtsQuery,
  useGetExpensesQuery,
  useGetExpenseSummaryQuery,
  useGetAnalyticsExpenseSeriesQuery,
  useGetDebtSummaryQuery,
  useGetCreditCardsQuery,
  useGetGoalQuery,
  useGetGoalsQuery,
  useGetIncomeMonthQuery,
  useGetIncomeSummaryQuery,
  useGetOnboardingStatusQuery,
  useGetSettingsQuery,
  useLazyGetGoalQuery,
  useLazyGetDebtDetailQuery,
  useLazyGetDebtPaymentsQuery,
  useLazyGetBudgetPlansQuery,
  useLazyGetPlanDebtsQuery,
  useLazyGetPlanSettingsQuery,
  useGetSubscriptionQuery,
  useCreateIncomeMutation,
  useCreateDebtMutation,
  useCreateExpenseMutation,
  useCreateDebtPaymentMutation,
  useDeleteExpenseMutation,
  useDeleteGoalMutation,
  useDeleteIncomeMutation,
  useDeleteDebtPaymentMutation,
  useCompleteOnboardingMutation,
  useConfirmIncomeSacrificeGoalTransferMutation,
  useConfirmReceiptMutation,
  useCreateGoalMutation,
  useResendEmailVerificationMutation,
  useScanReceiptMutation,
  useUpdateProfileMutation,
  useUpdateOnboardingProfileMutation,
  useUpdateDebtMutation,
  useUpdateExpenseMutation,
  useUpdateGoalMutation,
  useUpdateIncomeMutation,
  useUpdateIncomeSacrificeGoalLinkMutation,
  useUpdateIncomeSacrificeMutation,
  useUpdateSettingsMutation,
  useCreateIncomeSacrificeCustomMutation,
  useDeleteIncomeSacrificeCustomMutation,
  useCreateBudgetPlanMutation,
  useUpdateBudgetPlanMutation,
  useDeleteBudgetPlanMutation,
  useDeleteDebtMutation,
  useResetAccountDataMutation,
} = mobileApi;