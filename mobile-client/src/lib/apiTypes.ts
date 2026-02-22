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
  payments?: DebtPayment[];
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
}
