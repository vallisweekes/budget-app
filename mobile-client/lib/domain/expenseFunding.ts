import type { Debt, Settings } from "@/lib/apiTypes";

export type ExpenseFundingSource = "income" | "savings" | "emergency" | "investment" | "monthly_allowance" | "credit_card" | "loan" | "other";
export type ExpenseFundingCard = Pick<Debt, "id" | "name" | "type">;

export type ExpenseFundingOption = {
  key: string;
  label: string;
  source: ExpenseFundingSource;
  debtId: string | null;
};

type FundingSettings = Pick<Settings, "savingsBalance" | "monthlySavingsContribution" | "emergencyBalance" | "monthlyEmergencyContribution" | "investmentBalance" | "monthlyInvestmentContribution" | "monthlyAllowance"> | null | undefined;

const STATIC_OPTION_LABELS: Record<Exclude<ExpenseFundingSource, "credit_card">, string> = {
  income: "Income",
  savings: "Savings",
  emergency: "Emergency fund",
  investment: "Investments",
  monthly_allowance: "Allowance",
  loan: "Loan",
  other: "Other",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatFundingDebtLabel(debt: ExpenseFundingCard): string {
  const rawName = normalizeSpacing(String(debt.name ?? ""));
  if (!rawName) {
    return debt.type === "credit_card" || debt.type === "store_card" ? "Card" : "Loan";
  }

  const withoutLeadingType = rawName.replace(/^(card|credit card|store card|loan)\s*[:\-]\s*/i, "");

  if (debt.type === "credit_card" || debt.type === "store_card") {
    const withoutCardSuffix = withoutLeadingType.replace(/\s+(credit\s+card|store\s+card|card)$/i, "");
    return toTitleCase(normalizeSpacing(withoutCardSuffix || withoutLeadingType));
  }

  return toTitleCase(normalizeSpacing(withoutLeadingType));
}

export function normalizeExpenseFundingSource(value: unknown): ExpenseFundingSource {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "savings") return "savings";
  if (normalized === "emergency" || normalized === "emergency_fund" || normalized === "emergency fund") return "emergency";
  if (normalized === "investment" || normalized === "investments") return "investment";
  if (normalized === "monthly_allowance" || normalized === "allowance" || normalized === "monthly allowance") return "monthly_allowance";
  if (normalized === "credit_card" || normalized === "card" || normalized === "credit card") return "credit_card";
  if (normalized === "loan") return "loan";
  if (normalized === "other" || normalized === "extra_untracked") return "other";
  return "income";
}

export function paymentSourceForFunding(source: ExpenseFundingSource): "income" | "savings" | "emergency" | "credit_card" | "extra_untracked" {
  if (source === "savings") return "savings";
  if (source === "emergency") return "emergency";
  if (source === "credit_card") return "credit_card";
  if (source === "investment" || source === "monthly_allowance" || source === "loan" || source === "other") return "extra_untracked";
  return "income";
}

export function requiresFundingDebt(source: ExpenseFundingSource): boolean {
  return source === "credit_card" || source === "loan";
}

export function isCreditLikeDebt(debt: Pick<Debt, "type">): boolean {
  return debt.type === "credit_card" || debt.type === "store_card";
}

export function isLoanLikeDebt(debt: Pick<Debt, "type">): boolean {
  return debt.type === "loan";
}

function hasConfiguredFundingValue(value: string | number | null | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return value.trim().length > 0;
}

function hasPositiveFundingValue(value: string | number | null | undefined): boolean {
  if (value == null) return false;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed > 0;
}

function hasSavingsFunding(settings: FundingSettings): boolean {
  return hasPositiveFundingValue(settings?.savingsBalance);
}

function hasEmergencyFunding(settings: FundingSettings): boolean {
  return hasPositiveFundingValue(settings?.emergencyBalance);
}

function hasInvestmentFunding(settings: FundingSettings): boolean {
  return hasPositiveFundingValue(settings?.investmentBalance);
}

function hasAllowanceFunding(settings: FundingSettings): boolean {
  return hasPositiveFundingValue(settings?.monthlyAllowance);
}

export function getCreditFundingCards(cards: ExpenseFundingCard[]): ExpenseFundingCard[] {
  return cards.filter((card) => isCreditLikeDebt(card));
}

export function getExpenseFundingSelectionKey(source: ExpenseFundingSource, debtId?: string | null): string {
  return requiresFundingDebt(source) && debtId ? `${source}:${debtId}` : source;
}

export function getExpenseFundingOptions(params: {
  cards: ExpenseFundingCard[];
  loanDebts?: ExpenseFundingCard[];
  settings?: FundingSettings;
  selectedSource: ExpenseFundingSource;
  selectedDebtId?: string | null;
  extraOptions?: ExpenseFundingSource[];
}): ExpenseFundingOption[] {
  const extraOptions = new Set(params.extraOptions ?? []);
  const staticOptions: ExpenseFundingOption[] = [
    { key: "income", label: STATIC_OPTION_LABELS.income, source: "income", debtId: null },
  ];

  if (hasSavingsFunding(params.settings)) {
    staticOptions.push({ key: "savings", label: STATIC_OPTION_LABELS.savings, source: "savings", debtId: null });
  }

  if (hasEmergencyFunding(params.settings)) {
    staticOptions.push({ key: "emergency", label: STATIC_OPTION_LABELS.emergency, source: "emergency", debtId: null });
  }

  if (extraOptions.has("investment") && hasInvestmentFunding(params.settings)) {
    staticOptions.push({ key: "investment", label: STATIC_OPTION_LABELS.investment, source: "investment", debtId: null });
  }

  if (extraOptions.has("monthly_allowance") && hasAllowanceFunding(params.settings)) {
    staticOptions.push({ key: "monthly_allowance", label: STATIC_OPTION_LABELS.monthly_allowance, source: "monthly_allowance", debtId: null });
  }

  const cardOptions = getCreditFundingCards(params.cards).map((debt) => ({
    key: `credit_card:${debt.id}`,
    label: formatFundingDebtLabel(debt),
    source: "credit_card" as const,
    debtId: debt.id,
  }));
  const options = [...staticOptions, ...cardOptions];

  const availableLoans = (params.loanDebts ?? []).filter((debt) => isLoanLikeDebt(debt));

  if (extraOptions.has("loan") && (availableLoans.length > 0 || params.selectedSource === "loan")) {
    options.push({ key: "loan", label: STATIC_OPTION_LABELS.loan, source: "loan", debtId: null });
  }

  if (extraOptions.has("other")) {
    options.push({ key: "other", label: STATIC_OPTION_LABELS.other, source: "other", debtId: null });
  }

  const selectionKey = getExpenseFundingSelectionKey(params.selectedSource, params.selectedDebtId);
  if (options.some((option) => option.key === selectionKey)) {
    return options;
  }

  if (params.selectedSource === "credit_card" && params.selectedDebtId) {
    return [
      ...staticOptions,
      {
        key: selectionKey,
        label: "Card: Linked account",
        source: params.selectedSource,
        debtId: params.selectedDebtId,
      },
      ...cardOptions,
    ];
  }

  return options;
}

export function getExpenseFundingSelectionLabel(
  options: ExpenseFundingOption[],
  source: ExpenseFundingSource,
  debtId?: string | null,
): string {
  const selected = options.find((option) => option.key === getExpenseFundingSelectionKey(source, debtId));
  if (selected) return selected.label;
  if (source === "credit_card") return "Card";
  if (source === "loan") return "Loan";
  return STATIC_OPTION_LABELS[source as keyof typeof STATIC_OPTION_LABELS] ?? "Income";
}