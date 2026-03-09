export const INCOME_SOURCE_OPTIONS = [
  {
    id: "salary",
    label: "Salary or wages",
    detail: "Best for users who mainly budget around a regular employer paycheck.",
    icon: "briefcase-outline",
    canonicalName: "Salary",
  },
  {
    id: "business",
    label: "Business income",
    detail: "For owners drawing income from a business, shop, or company profits.",
    icon: "storefront-outline",
    canonicalName: "Business income",
  },
  {
    id: "freelance",
    label: "Freelance or contract",
    detail: "Useful when income lands from client work and timing or amounts can vary.",
    icon: "laptop-outline",
    canonicalName: "Freelance",
  },
  {
    id: "benefits",
    label: "Benefits or pension",
    detail: "For users whose main monthly support is government, pension, or assistance income.",
    icon: "shield-checkmark-outline",
    canonicalName: "Benefits",
  },
  {
    id: "investments",
    label: "Rental or investment income",
    detail: "For income driven mostly by rent, dividends, or other asset-based payments.",
    icon: "trending-up-outline",
    canonicalName: "Investment income",
  },
  {
    id: "mixed",
    label: "Mixed income",
    detail: "Best when no single source clearly dominates and budgeting needs to stay flexible.",
    icon: "git-merge-outline",
    canonicalName: "Mixed income",
  },
] as const;