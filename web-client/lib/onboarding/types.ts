import type { PayFrequency } from "@/lib/payPeriods";

export const COMMON_OCCUPATIONS = [
  "Accountant",
  "Administrator",
  "Chef",
  "Construction",
  "Customer Service",
  "Designer",
  "Driver",
  "Electrician",
  "Engineer",
  "Healthcare Worker",
  "Hospitality",
  "Lawyer",
  "Manager",
  "Mechanic",
  "Nurse",
  "Retail",
  "Sales",
  "Self-employed",
  "Software Developer",
  "Teacher",
  "Other",
] as const;

export type OnboardingGoalInput =
  | "improve_savings"
  | "emergency_fund"
  | "investments"
  | "manage_debts"
  | "track_spending"
  | "build_budget";

export type VisibleOnboardingGoal = "improve_savings" | "emergency_fund" | "investments";

export type OnboardingInput = {
  mainGoal?: OnboardingGoalInput | null;
  mainGoals?: OnboardingGoalInput[] | null;
  occupation?: string | null;
  occupationOther?: string | null;
  payDay?: number | null;
  payAnchorDate?: string | Date | null;
  payFrequency?: PayFrequency | null;
  billFrequency?: "monthly" | "every_2_weeks" | null;
  monthlySalary?: number | null;
  planningYears?: number | null;
  savingsGoalAmount?: number | null;
  savingsGoalYear?: number | null;
  expenseOneName?: string | null;
  expenseOneAmount?: number | null;
  expenseTwoName?: string | null;
  expenseTwoAmount?: number | null;
  expenseThreeName?: string | null;
  expenseThreeAmount?: number | null;
  expenseFourName?: string | null;
  expenseFourAmount?: number | null;
  hasAllowance?: boolean | null;
  allowanceAmount?: number | null;
  hasDebtsToManage?: boolean | null;
  debtAmount?: number | null;
  debtNotes?: string | null;
};

export type OnboardingProfileRecord = {
  status: "started" | "completed";
  completedAt?: Date | null;
  updatedAt?: Date | null;
  mainGoal: OnboardingGoalInput | null;
  mainGoals: OnboardingGoalInput[];
  occupation: string | null;
  occupationOther: string | null;
  payDay: number | null;
  payAnchorDate: Date | null;
  payFrequency: PayFrequency | null;
  billFrequency: "monthly" | "every_2_weeks" | null;
  monthlySalary: unknown;
  planningYears: number | null;
  savingsGoalAmount: unknown;
  savingsGoalYear: number | null;
  expenseOneName: string | null;
  expenseOneAmount: unknown;
  expenseTwoName: string | null;
  expenseTwoAmount: unknown;
  expenseThreeName: string | null;
  expenseThreeAmount: unknown;
  expenseFourName: string | null;
  expenseFourAmount: unknown;
  hasAllowance: boolean | null;
  allowanceAmount: unknown;
  hasDebtsToManage: boolean | null;
  debtAmount: unknown;
  debtNotes: string | null;
  generatedPlanId: string | null;
};

export type NormalizedOnboardingProfile = {
  mainGoal: OnboardingGoalInput | null;
  mainGoals: OnboardingGoalInput[];
  occupation: string | null;
  occupationOther: string | null;
  payDay: number | null;
  payAnchorDate: string | null;
  payFrequency: PayFrequency | null;
  billFrequency: "monthly" | "every_2_weeks" | null;
  monthlySalary: number | null;
  planningYears: number | null;
  savingsGoalAmount: number | null;
  savingsGoalYear: number | null;
  expenseOneName: string | null;
  expenseOneAmount: number | null;
  expenseTwoName: string | null;
  expenseTwoAmount: number | null;
  expenseThreeName: string | null;
  expenseThreeAmount: number | null;
  expenseFourName: string | null;
  expenseFourAmount: number | null;
  hasAllowance: boolean | null;
  allowanceAmount: number | null;
  hasDebtsToManage: boolean | null;
  debtAmount: number | null;
  debtNotes: string | null;
};

export const EMPTY_ONBOARDING_PROFILE: NormalizedOnboardingProfile = {
  mainGoal: null,
  mainGoals: [],
  occupation: null,
  occupationOther: null,
  payDay: null,
  payAnchorDate: null,
  payFrequency: null,
  billFrequency: null,
  monthlySalary: null,
  planningYears: null,
  savingsGoalAmount: null,
  savingsGoalYear: null,
  expenseOneName: null,
  expenseOneAmount: null,
  expenseTwoName: null,
  expenseTwoAmount: null,
  expenseThreeName: null,
  expenseThreeAmount: null,
  expenseFourName: null,
  expenseFourAmount: null,
  hasAllowance: null,
  allowanceAmount: null,
  hasDebtsToManage: null,
  debtAmount: null,
  debtNotes: null,
};

export type OnboardingDelegate = {
  create: (args: Record<string, unknown>) => Promise<unknown>;
  findUnique: (args: Record<string, unknown>) => Promise<OnboardingProfileRecord | null>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};

export type DerivedExpenseCandidate = {
  name: string;
  amount: number;
  count: number;
  hasDueDate: boolean;
  isDirectDebit: boolean;
  latestYear: number;
  latestMonth: number;
};

export type SeedPeriod = { month: number; year: number };

export type ExpenseSeedInput = {
  name: string;
  amount: number;
  categoryId?: string | null;
};