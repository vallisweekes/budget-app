import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface BffCategory {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  featured: boolean;
}

export interface BffExpense {
  id: string;
  name: string;
  amount: string; // Decimal as string
  paid: boolean;
  paidAmount: string; // Decimal as string
  isAllocation: boolean;
  month: number;
  year: number;
  categoryId?: string | null;
  category?: BffCategory | null;
}

export interface BffIncome {
  id: string;
  name: string;
  amount: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface BffDebtPayment {
  id: string;
  debtId: string;
  amount: string;
  paidAt: string;
  year?: number;
  month?: number;
  source?: "income" | "extra_funds";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BffDebt {
  id: string;
  name: string;
  type: string;
  initialBalance: string;
  currentBalance: string;
  amount: string;
  paid: boolean;
  paidAmount: string;
  monthlyMinimum?: string | null;
  sourceType?: string | null;
  sourceExpenseId?: string | null;
  sourceMonthKey?: string | null;
  sourceCategoryId?: string | null;
  sourceCategoryName?: string | null;
  sourceExpenseName?: string | null;
  payments?: BffDebtPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface BffGoal {
  id: string;
  title: string;
  type: string;
  category: string;
  description?: string | null;
  targetAmount?: string | null;
  currentAmount?: string | null;
  targetYear?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BffSettings {
  id: string;
  payDate: number;
  monthlyAllowance: string;
  savingsBalance: string;
  monthlySavingsContribution: string;
  monthlyEmergencyContribution: string;
  monthlyInvestmentContribution: string;
  budgetStrategy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetExpensesArgs {
  month: number;
  year: number;
}

export interface GetIncomeArgs {
  month?: number;
  year?: number;
}

export interface CreateExpenseBody {
  name: string;
  amount: number;
  month: number;
  year: number;
  categoryId?: string;
  paid?: boolean;
  isAllocation?: boolean;
}

export interface UpdateExpenseBody {
  id: string;
  name: string;
  amount: number;
  categoryId?: string;
  isAllocation?: boolean;
}

export interface CreateIncomeBody {
  name: string;
  amount: number;
  month: number;
  year: number;
}

export interface CreateDebtBody {
  name: string;
  type: string;
  initialBalance: number;
  currentBalance?: number;
  amount: number;
  monthlyMinimum?: number;
  paid?: boolean;
  paidAmount?: number;
}

export interface CreateDebtPaymentBody {
  amount: number;
  paidAt?: string;
  source?: "income" | "extra_funds";
  notes?: string;
}

export interface CreateGoalBody {
  title: string;
  type: string;
  category: string;
  description?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetYear?: number;
}

export const bffApi = createApi({
  reducerPath: "bffApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/bff" }),
  tagTypes: ["Expense", "Category", "Income", "Debt", "Goal", "Settings"],
  endpoints: (builder) => ({
    // Categories
    getCategories: builder.query<BffCategory[], void>({
      query: () => "categories",
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({ type: "Category" as const, id: c.id })),
              { type: "Category" as const, id: "LIST" },
            ]
          : [{ type: "Category" as const, id: "LIST" }],
    }),

    addCategory: builder.mutation<BffCategory, Partial<BffCategory>>({
      query: (body) => ({
        url: "categories",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    updateCategory: builder.mutation<BffCategory, Partial<BffCategory> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `categories/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Category", id: arg.id },
        { type: "Category", id: "LIST" },
      ],
    }),

    deleteCategory: builder.mutation<{ success: true }, { id: string }>({
      query: ({ id }) => ({
        url: `categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    // Expenses
    getExpenses: builder.query<BffExpense[], GetExpensesArgs>({
      query: ({ month, year }) => `expenses?month=${month}&year=${year}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map((e) => ({ type: "Expense" as const, id: e.id })),
              { type: "Expense" as const, id: "LIST" },
            ]
          : [{ type: "Expense" as const, id: "LIST" }],
    }),

    addExpense: builder.mutation<BffExpense, CreateExpenseBody>({
      query: (body) => ({
        url: "expenses",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Expense", id: "LIST" }],
    }),

    updateExpense: builder.mutation<BffExpense, UpdateExpenseBody>({
      query: ({ id, ...body }) => ({
        url: `expenses/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Expense", id: arg.id },
        { type: "Expense", id: "LIST" },
      ],
    }),

    deleteExpense: builder.mutation<{ success: true }, { id: string }>({
      query: ({ id }) => ({
        url: `expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Expense", id: arg.id },
        { type: "Expense", id: "LIST" },
      ],
    }),

    // Income
    getIncome: builder.query<BffIncome[], GetIncomeArgs | void>({
      query: (args) => {
        if (!args) return "income";
        const params = new URLSearchParams();
        if (args.month) params.append("month", String(args.month));
        if (args.year) params.append("year", String(args.year));
        return `income?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((i) => ({ type: "Income" as const, id: i.id })),
              { type: "Income" as const, id: "LIST" },
            ]
          : [{ type: "Income" as const, id: "LIST" }],
    }),

    addIncome: builder.mutation<BffIncome, CreateIncomeBody>({
      query: (body) => ({
        url: "income",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Income", id: "LIST" }],
    }),

    updateIncome: builder.mutation<BffIncome, Partial<BffIncome> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `income/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Income", id: arg.id },
        { type: "Income", id: "LIST" },
      ],
    }),

    deleteIncome: builder.mutation<{ success: true }, { id: string }>({
      query: ({ id }) => ({
        url: `income/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Income", id: "LIST" }],
    }),

    // Debts
    getDebts: builder.query<BffDebt[], void>({
      query: () => "debts",
      providesTags: (result) =>
        result
          ? [
              ...result.map((d) => ({ type: "Debt" as const, id: d.id })),
              { type: "Debt" as const, id: "LIST" },
            ]
          : [{ type: "Debt" as const, id: "LIST" }],
    }),

    addDebt: builder.mutation<BffDebt, CreateDebtBody>({
      query: (body) => ({
        url: "debts",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Debt", id: "LIST" }],
    }),

    updateDebt: builder.mutation<BffDebt, Partial<BffDebt> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `debts/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Debt", id: arg.id },
        { type: "Debt", id: "LIST" },
      ],
    }),

    deleteDebt: builder.mutation<{ success: true }, { id: string }>({
      query: ({ id }) => ({
        url: `debts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Debt", id: "LIST" }],
    }),

    addDebtPayment: builder.mutation<BffDebtPayment, { debtId: string } & CreateDebtPaymentBody>({
      query: ({ debtId, ...body }) => ({
        url: `debts/${debtId}/payments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Debt", id: arg.debtId },
        { type: "Debt", id: "LIST" },
      ],
    }),

    // Goals
    getGoals: builder.query<BffGoal[], void>({
      query: () => "goals",
      providesTags: (result) =>
        result
          ? [
              ...result.map((g) => ({ type: "Goal" as const, id: g.id })),
              { type: "Goal" as const, id: "LIST" },
            ]
          : [{ type: "Goal" as const, id: "LIST" }],
    }),

    addGoal: builder.mutation<BffGoal, CreateGoalBody>({
      query: (body) => ({
        url: "goals",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Goal", id: "LIST" }],
    }),

    updateGoal: builder.mutation<BffGoal, Partial<BffGoal> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `goals/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Goal", id: arg.id },
        { type: "Goal", id: "LIST" },
      ],
    }),

    deleteGoal: builder.mutation<{ success: true }, { id: string }>({
      query: ({ id }) => ({
        url: `goals/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Goal", id: "LIST" }],
    }),

    // Settings
    getSettings: builder.query<BffSettings, void>({
      query: () => "settings",
      providesTags: [{ type: "Settings", id: "default" }],
    }),

    updateSettings: builder.mutation<BffSettings, Partial<BffSettings>>({
      query: (body) => ({
        url: "settings",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [{ type: "Settings", id: "default" }],
    }),
  }),
});

export const {
  // Categories
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  // Expenses
  useGetExpensesQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  // Income
  useGetIncomeQuery,
  useAddIncomeMutation,
  useUpdateIncomeMutation,
  useDeleteIncomeMutation,
  // Debts
  useGetDebtsQuery,
  useAddDebtMutation,
  useUpdateDebtMutation,
  useDeleteDebtMutation,
  useAddDebtPaymentMutation,
  // Goals
  useGetGoalsQuery,
  useAddGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
  // Settings
  useGetSettingsQuery,
  useUpdateSettingsMutation,
} = bffApi;

