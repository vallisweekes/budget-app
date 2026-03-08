import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { ApiError, apiFetch } from "@/lib/api";
import type { BudgetPlanListItem, BudgetPlansResponse, DashboardData, Debt, Settings, SubscriptionSummaryResponse, UserProfile } from "@/lib/apiTypes";
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
  tagTypes: ["Dashboard", "Settings", "Subscription", "UserProfile", "BudgetPlans", "Debts"],
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
  useGetSettingsQuery,
  useLazyGetBudgetPlansQuery,
  useLazyGetPlanDebtsQuery,
  useLazyGetPlanSettingsQuery,
  useLazyGetUserProfileQuery,
  useGetSubscriptionQuery,
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
  useCreateIncomeSacrificeCustomMutation,
  useDeleteIncomeSacrificeCustomMutation,
  useCreateBudgetPlanMutation,
  useUpdateBudgetPlanMutation,
  useDeleteBudgetPlanMutation,
  useResetAccountDataMutation,
} = mobileApi;