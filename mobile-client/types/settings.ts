export type SettingsTab = "details" | "budget" | "savings" | "locale" | "plans" | "subscription" | "notifications" | "danger";
export type PlanKind = "personal" | "holiday" | "carnival";
export type DebtKind = "credit_card" | "loan" | "hire_purchase";
export type PayFrequency = "monthly" | "every_2_weeks" | "weekly";
export type BillFrequency = "monthly" | "every_2_weeks";
export type BudgetField = "payDate" | "horizon" | "payFrequency" | "billFrequency";
export type SavingsField = "savings" | "emergency" | "investment";
export type MoneyViewMode = "personal" | "cards";
export type SavingsSheetMode = "add" | "edit";
export type SavingsBalanceField = "savingsBalance" | "emergencyBalance" | "investmentBalance";

export type SavingsPot = {
  id: string;
  field: SavingsField;
  name: string;
  amount: number;
  allocationId?: string;
};

export type SavingsPotStore = Record<string, SavingsPot[]>;

export type NotificationPrefs = {
  dueReminders: boolean;
  paymentAlerts: boolean;
  dailyTips: boolean;
};

export type NotificationPrefsResponse = {
  ok?: boolean;
  dueReminders?: boolean;
  paymentAlerts?: boolean;
  dailyTips?: boolean;
};

export type SacrificeGoalsResponse = {
  goals?: Array<{ id?: string }>;
  links?: Array<{ targetKey?: string }>;
};

export type CreateSacrificeItemResponse = {
  success?: boolean;
  item?: {
    id?: string;
  };
};
