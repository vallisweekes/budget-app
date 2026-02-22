/** Shared type definitions mirroring the web-client /api/bff/* response shapes */

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  budgetAmount: string | null;
  budgetPlanId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: string;
  paid: boolean;
  paidAmount: string;
  isAllocation: boolean;
  month: number;
  year: number;
  categoryId: string;
  category: Category | null;
  dueDate: string | null;
}

export interface Income {
  id: string;
  name: string;
  amount: string;
  month: number;
  year: number;
  budgetPlanId: string;
}

export interface DebtPayment {
  id: string;
  amount: string;
  paidAt: string;
  notes: string | null;
}

export interface Debt {
  id: string;
  name: string;
  currentBalance: string;
  paidAmount: string;
  originalBalance: string;
  interestRate: string | null;
  type: string;
  paid: boolean;
  monthlyMinimum: string | null;
  installmentMonths: number | null;
  creditLimit: string | null;
  dueDay: number | null;
  sourceType: string | null;
  sourceExpenseName: string | null;
  payments?: DebtPayment[];
}

/** Full debt shape from /api/bff/debt-summary — includes server-computed fields */
export interface DebtSummaryItem {
  id: string;
  name: string;
  type: string;
  displayTitle?: string;
  displaySubtitle?: string;
  currentBalance: number;
  initialBalance: number;
  paidAmount: number;
  monthlyMinimum: number | null;
  interestRate: number | null;
  installmentMonths: number | null;
  amount: number;
  paid: boolean;
  creditLimit: number | null;
  dueDay: number | null;
  sourceType: string | null;
  sourceMonthKey?: string | null;
  sourceCategoryName?: string | null;
  sourceExpenseName: string | null;
  computedMonthlyPayment: number;
  isActive: boolean;
}

export interface DebtTip {
  title: string;
  detail: string;
  urgency?: string;
}

export interface DebtSummaryData {
  debts: DebtSummaryItem[];
  activeCount: number;
  paidCount: number;
  totalDebtBalance: number;
  totalMonthlyDebtPayments: number;
  creditCardCount: number;
  regularDebtCount: number;
  expenseDebtCount: number;
  tips: DebtTip[];
}

export interface Goal {
  id: string;
  title: string;
  type: string;
  category: string | null;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  targetYear: number | null;
}

export interface Settings {
  id: string;
  payDate: number | null;
  monthlyAllowance: string | null;
  savingsBalance: string | null;
  monthlySavingsContribution: string | null;
  monthlyEmergencyContribution: string | null;
  monthlyInvestmentContribution: string | null;
  budgetStrategy: string | null;
  homepageGoalIds: string[];
  country: string | null;
  language: string | null;
  currency: string | null;
  /** ISO date string of when the user account was created — used to guard year navigation */
  accountCreatedAt?: string | null;
}

// ─── Computed / Aggregated API types ─────────────────────────

/** Category data with pre-computed expense totals from /api/bff/dashboard */
export interface DashboardCategoryItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  total: number;
  expenses: Array<{
    id: string;
    name: string;
    amount: number;
    paid: boolean;
    paidAmount: number;
    categoryId?: string;
  }>;
}

/** Goal shape returned by dashboard endpoint */
export interface DashboardGoal {
  id: string;
  title: string;
  type: string;
  category: string;
  description?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetYear?: number;
}

/** Debt shape with computed monthly payment from /api/bff/dashboard */
export interface DashboardDebt {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  paidAmount: number;
  monthlyMinimum: number | null;
  interestRate: number | null;
  installmentMonths: number | null;
  amount: number;
  creditLimit: number | null;
  sourceType: string | null;
}

/** Upcoming payment from expense insights */
export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  paidAmount: number;
  status: "paid" | "partial" | "unpaid";
  dueDate: string;
  daysUntilDue: number;
  urgency: "overdue" | "today" | "soon" | "later";
}

/** Previous month recap from expense insights */
export interface PreviousMonthRecap {
  label: string;
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  partialCount: number;
  partialAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  missedDueCount: number;
  missedDueAmount: number;
}

/** Tip / insight */
export interface InsightTip {
  title: string;
  detail: string;
}

/** Expense insights from /api/bff/expense-insights */
export interface ExpenseInsights {
  recap: PreviousMonthRecap | null;
  upcoming: UpcomingPayment[];
  recapTips: InsightTip[];
}

/**
 * Full computed dashboard payload from GET /api/bff/dashboard.
 * This is the single source of truth for both web and mobile clients.
 */
export interface DashboardData {
  budgetPlanId: string;
  month: string;
  year: number;
  monthNum: number;

  // Budget totals
  totalIncome: number;
  totalExpenses: number;
  remaining: number;

  // Allocations
  totalAllocations: number;
  plannedDebtPayments: number;
  plannedSavingsContribution: number;
  plannedEmergencyContribution: number;
  plannedInvestments: number;
  incomeAfterAllocations: number;

  // Categories with expense breakdowns
  categoryData: DashboardCategoryItem[];

  // Goals
  goals: DashboardGoal[];
  homepageGoalIds: string[];

  // Debts
  debts: DashboardDebt[];
  totalDebtBalance: number;

  // Expense insights
  expenseInsights: ExpenseInsights;

  // Multi-plan data
  allPlansData: Record<string, unknown>;
  largestExpensesByPlan: Record<string, unknown>;
  incomeMonthsCoverageByPlan: Record<string, number>;

  // Meta
  payDate: number;
}

/** Zero-based budget summary from /api/bff/budget-summary */
export interface BudgetSummary {
  month: string;
  year: number;
  incomeTotal: number;
  expenseTotal: number;
  debtPaymentsTotal: number;
  spendingTotal: number;
  plannedAllowance: number;
  plannedSavings: number;
  plannedEmergency: number;
  plannedInvestments: number;
  unallocated: number;
}

/** Debt with computed monthly payment from /api/bff/debt-summary */
export interface DebtSummaryItem {
  id: string;
  name: string;
  type: string;
  displayTitle?: string;
  displaySubtitle?: string;
  currentBalance: number;
  initialBalance: number;
  paidAmount: number;
  monthlyMinimum: number | null;
  interestRate: number | null;
  installmentMonths: number | null;
  amount: number;
  paid: boolean;
  creditLimit: number | null;
  dueDay: number | null;
  sourceType: string | null;
  sourceMonthKey?: string | null;
  sourceCategoryName?: string | null;
  sourceExpenseName: string | null;
  computedMonthlyPayment: number;
  isActive: boolean;
}

/** Full debt summary from /api/bff/debt-summary */
export interface DebtSummaryResponse {
  debts: DebtSummaryItem[];
  activeCount: number;
  paidCount: number;
  totalDebtBalance: number;
  totalMonthlyDebtPayments: number;
  creditCardCount: number;
  regularDebtCount: number;
  expenseDebtCount: number;
  tips: InsightTip[];
}

/** Single income item within a month */
export interface IncomeSummaryItem {
  id: string;
  name: string;
  amount: number;
}

/** Monthly income entry from /api/bff/income-summary */
export interface IncomeSummaryMonth {
  monthKey: string;
  monthIndex: number; // 1-12
  items: IncomeSummaryItem[];
  total: number;
}

/** Full income summary from GET /api/bff/income-summary */
export interface IncomeSummaryData {
  year: number;
  budgetPlanId: string;
  months: IncomeSummaryMonth[];
  grandTotal: number;
  monthsWithIncome: number;
}

/** Computed income month data from GET /api/bff/income-month */
export interface IncomeMonthData {
  budgetPlanId: string;
  month: number;
  year: number;
  monthKey: string;

  // Income
  incomeItems: IncomeSummaryItem[];
  grossIncome: number;
  sourceCount: number;

  // Expenses
  plannedExpenses: number;
  paidExpenses: number;

  // Debts
  plannedDebtPayments: number;
  paidDebtPayments: number;

  // Allocations / sacrifice
  monthlyAllowance: number;
  incomeSacrifice: number;
  setAsideBreakdown: {
    savings: number;
    emergency: number;
    investments: number;
    custom: number;
  };

  // Summary
  plannedBills: number;
  paidBillsSoFar: number;
  remainingBills: number;
  moneyLeftAfterPlan: number;
  incomeLeftRightNow: number;
  moneyOutTotal: number;
  isOnPlan: boolean;
}

/** /api/bff/expenses/summary — server-computed monthly expense totals */
export interface ExpenseCategoryBreakdown {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  total: number;
  paidTotal: number;
  paidCount: number;
  totalCount: number;
}

export interface ExpenseSummary {
  month: number;
  year: number;
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  categoryBreakdown: ExpenseCategoryBreakdown[];
}
