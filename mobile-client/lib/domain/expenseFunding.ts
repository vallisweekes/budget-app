import type { Debt, Settings } from "@/lib/apiTypes";

export type ExpenseFundingSource = "income" | "savings" | "emergency" | "credit_card" | "loan" | "other";
export type ExpenseFundingCard = Pick<Debt, "id" | "name" | "type">;

export type ExpenseFundingOption = {
  key: string;
  label: string;
  source: ExpenseFundingSource;
  debtId: string | null;
};

type FundingSettings = Pick<Settings, "savingsBalance" | "monthlySavingsContribution" | "emergencyBalance" | "monthlyEmergencyContribution"> | null | undefined;

const STATIC_OPTION_LABELS: Record<Exclude<ExpenseFundingSource, "credit_card" | "loan">, string> = {
  income: "Income",
  savings: "Savings",
  emergency: "Emergency fund",
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
  if (normalized === "credit_card" || normalized === "card" || normalized === "credit card") return "credit_card";
  if (normalized === "loan") return "loan";
  if (normalized === "other" || normalized === "extra_untracked" || normalized === "monthly_allowance") return "income";
  return "income";
}

export function paymentSourceForFunding(source: ExpenseFundingSource): "income" | "savings" | "emergency" | "credit_card" | "extra_untracked" {
  if (source === "savings") return "savings";
  if (source === "emergency") return "emergency";
  if (source === "credit_card") return "credit_card";
  if (source === "loan" || source === "other") return "extra_untracked";
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

function hasSavingsFunding(settings: FundingSettings): boolean {
  return hasConfiguredFundingValue(settings?.savingsBalance) || hasConfiguredFundingValue(settings?.monthlySavingsContribution);
}

function hasEmergencyFunding(settings: FundingSettings): boolean {
  return hasConfiguredFundingValue(settings?.emergencyBalance) || hasConfiguredFundingValue(settings?.monthlyEmergencyContribution);
}

export function getCreditFundingCards(cards: ExpenseFundingCard[]): ExpenseFundingCard[] {
  return cards.filter((card) => isCreditLikeDebt(card));
}

export function getExpenseFundingSelectionKey(source: ExpenseFundingSource, debtId?: string | null): string {
  return requiresFundingDebt(source) && debtId ? `${source}:${debtId}` : source;
}

export function getExpenseFundingOptions(params: {
  cards: ExpenseFundingCard[];
  settings?: FundingSettings;
  selectedSource: ExpenseFundingSource;
  selectedDebtId?: string | null;
}): ExpenseFundingOption[] {
  const staticOptions: ExpenseFundingOption[] = [
    { key: "income", label: STATIC_OPTION_LABELS.income, source: "income", debtId: null },
  ];

  if (hasSavingsFunding(params.settings)) {
    staticOptions.push({ key: "savings", label: STATIC_OPTION_LABELS.savings, source: "savings", debtId: null });
  }

  if (hasEmergencyFunding(params.settings)) {
    staticOptions.push({ key: "emergency", label: STATIC_OPTION_LABELS.emergency, source: "emergency", debtId: null });
  }

  const cardOptions = getCreditFundingCards(params.cards).map((debt) => ({
    key: `credit_card:${debt.id}`,
    label: formatFundingDebtLabel(debt),
    source: "credit_card" as const,
    debtId: debt.id,
  }));
  const options = [...staticOptions, ...cardOptions];

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