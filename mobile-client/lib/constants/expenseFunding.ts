export const NEW_LOAN_SENTINEL = "__new_loan__";

export const FUNDING_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "savings", label: "Savings" },
  { value: "monthly_allowance", label: "Monthly allowance" },
  { value: "credit_card", label: "Credit card" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
] as const;