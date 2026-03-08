import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { ApiError, apiFetch } from "@/lib/api";
import type { DashboardData, Settings, SubscriptionSummaryResponse, UserProfile } from "@/lib/apiTypes";

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
  tagTypes: ["Dashboard", "Settings", "Subscription", "UserProfile"],
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
    updateSettings: builder.mutation<Settings, { budgetPlanId: string; changes: Partial<Settings> }>({
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
  }),
});

export const {
  useGetDashboardQuery,
  useGetSettingsQuery,
  useGetSubscriptionQuery,
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
} = mobileApi;