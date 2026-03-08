import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { ApiError, apiFetch } from "@/lib/api";
import type { BudgetPlanListItem, BudgetPlansResponse, CreditCard, DashboardData, Debt, DebtPayment, DebtSummaryData, ExpenseSummary, IncomeSummaryData, OnboardingProfile, OnboardingStatusResponse, Settings, SubscriptionSummaryResponse, UserProfile } from "@/lib/apiTypes";
import type { CreateSacrificeItemResponse } from "@/types/settings";

function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(err instanceof Error ? err.message : "Request failed", {
    status: 500,
    code: "UNKNOWN_ERROR",
  });
}

export const mobileApi = createApi({
  reducerPath: "mobileApi",
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ["Dashboard", "Settings", "Subscription", "UserProfile", "BudgetPlans", "Debts", "CreditCards", "Onboarding"],
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
    getUserProfile: builder.query<UserProfile, void>({
      async queryFn() {
        try {
          const data = await apiFetch<UserProfile>("/api/bff/me", { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["UserProfile"],
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
    }>({
      async queryFn({ month, year, budgetPlanId, scope = "pay_period" }) {
        try {
          const planQp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
          const data = await apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}&scope=${scope}${planQp}`, { cacheTtlMs: 0 });
          return { data };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
      providesTags: ["Dashboard"],
    }),
    getAnalyticsExpenseSeries: builder.query<number[], {
      year: number;
      budgetPlanId?: string | null;
    }>({
      async queryFn({ year, budgetPlanId }) {
        try {
          const series = await Promise.all(
            Array.from({ length: 12 }, async (_, idx) => {
              const month = idx + 1;
              const planQp = budgetPlanId ? `&budgetPlanId=${encodeURIComponent(budgetPlanId)}` : "";
              const summary = await apiFetch<ExpenseSummary>(`/api/bff/expenses/summary?month=${month}&year=${year}&scope=pay_period${planQp}`, { cacheTtlMs: 0 });
              return summary?.totalAmount ?? 0;
            })
          );
          return { data: series };
        } catch (err: unknown) {
          return { error: normalizeApiError(err) };
        }
      },
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
    updateProfile: builder.mutation<UserProfile, { email: string | null }>({
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
      invalidatesTags: ["Onboarding", "Dashboard"],
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
    createIncomeSacrificeCustom: builder.mutation<CreateSacrificeItemResponse, {
      budgetPlanId: string;
      type: string;
      name: string;
      amount: number;
      month: number;
      year: number;
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
      invalidatesTags: ["Settings", "Dashboard"],
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
      invalidatesTags: ["Settings", "Dashboard"],
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
  useGetExpenseSummaryQuery,
  useGetAnalyticsExpenseSeriesQuery,
  useGetDebtSummaryQuery,
  useGetCreditCardsQuery,
  useGetIncomeSummaryQuery,
  useGetOnboardingStatusQuery,
  useGetSettingsQuery,
  useLazyGetDebtDetailQuery,
  useLazyGetDebtPaymentsQuery,
  useLazyGetBudgetPlansQuery,
  useLazyGetPlanDebtsQuery,
  useLazyGetPlanSettingsQuery,
  useLazyGetUserProfileQuery,
  useGetSubscriptionQuery,
  useCreateDebtMutation,
  useCreateDebtPaymentMutation,
  useUpdateProfileMutation,
  useUpdateOnboardingProfileMutation,
  useUpdateDebtMutation,
  useUpdateSettingsMutation,
  useCreateIncomeSacrificeCustomMutation,
  useDeleteIncomeSacrificeCustomMutation,
  useCreateBudgetPlanMutation,
  useUpdateBudgetPlanMutation,
  useDeleteBudgetPlanMutation,
  useDeleteDebtMutation,
  useResetAccountDataMutation,
} = mobileApi;