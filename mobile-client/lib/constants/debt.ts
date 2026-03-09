export const TYPE_COLORS: Record<string, string> = {
  credit_card: "#e25c5c",
  store_card: "#f4a942",
  loan: "#a78bfa",
  mortgage: "#38bdf8",
  hire_purchase: "#f4a942",
  other: "#64748b",
};

export const TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  store_card: "Store Card",
  loan: "Loan",
  mortgage: "Mortgage",
  hire_purchase: "Hire Purchase",
  other: "Other",
};

export const TERM_PRESETS = [2, 3, 6, 12, 24, 36, 48] as const;

export const PAYMENT_SOURCE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "extra_funds", label: "Extra funds" },
  { value: "credit_card", label: "Card" },
] as const;