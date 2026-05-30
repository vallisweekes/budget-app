import type { ExpenseCategoryBreakdown } from "@/lib/apiTypes";

type ExpenseCategoryDefinition = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  featured: boolean;
};

const BASE_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { id: "carnival", name: "Carnival", icon: "PartyPopper", color: "pink", featured: true },
  { id: "business", name: "Business Trip", icon: "Briefcase", color: "slate", featured: true },
  { id: "childcare", name: "Childcare", icon: "Baby", color: "pink", featured: true },
  { id: "custom", name: "Custom", icon: "Star", color: "amber", featured: true },
  { id: "entertainment", name: "Entertainment", icon: "Gamepad2", color: "red", featured: true },
  { id: "food", name: "Food & Dining", icon: "UtensilsCrossed", color: "green", featured: true },
  { id: "holiday", name: "Holiday", icon: "Palmtree", color: "teal", featured: true },
  { id: "housing", name: "Housing", icon: "Home", color: "blue", featured: true },
  { id: "insurance", name: "Insurance", icon: "Shield", color: "indigo", featured: true },
  { id: "investments", name: "Investments", icon: "TrendingUp", color: "purple", featured: true },
  { id: "personal", name: "Personal Care", icon: "Scissors", color: "cyan", featured: true },
  { id: "savings", name: "Savings", icon: "PiggyBank", color: "emerald", featured: true },
  { id: "subscriptions", name: "Subscriptions", icon: "Smartphone", color: "purple", featured: true },
  { id: "transport", name: "Transport", icon: "Car", color: "orange", featured: true },
  { id: "utilities", name: "Utilities", icon: "Zap", color: "yellow", featured: true },
];

const PERSONAL_ONLY_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { id: "fees_and_charges", name: "Fees & Charges", icon: "Receipt", color: "slate", featured: false },
];

const HOLIDAY_ONLY_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { id: "activities", name: "Activities", icon: "Sparkles", color: "pink", featured: true },
  { id: "tours", name: "Tours", icon: "Map", color: "amber", featured: true },
  { id: "spending_money", name: "Spending Money", icon: "Wallet", color: "slate", featured: false },
  { id: "accommodation", name: "Accommodation", icon: "Home", color: "emerald", featured: false },
  { id: "flights", name: "Flights", icon: "Plane", color: "cyan", featured: false },
  { id: "rental", name: "Rental", icon: "Key", color: "indigo", featured: false },
];

const CARNIVAL_ONLY_EXPENSE_CATEGORIES: ExpenseCategoryDefinition[] = [
  { id: "costumes", name: "Costumes", icon: "Shirt", color: "pink", featured: true },
  { id: "events_tickets", name: "Events Tickets", icon: "Ticket", color: "amber", featured: true },
  { id: "jouvert_package", name: "Jouvert Package", icon: "Package", color: "violet", featured: true },
  { id: "transport", name: "Transport", icon: "Car", color: "sky", featured: false },
  { id: "accommodation", name: "Accommodation", icon: "Home", color: "emerald", featured: false },
  { id: "flights", name: "Flights", icon: "Plane", color: "cyan", featured: false },
  { id: "spending_money", name: "Spending Money", icon: "Wallet", color: "slate", featured: false },
  { id: "drinks_and_food", name: "Drinks and Food", icon: "Utensils", color: "orange", featured: false },
  { id: "rental", name: "Rental", icon: "Key", color: "indigo", featured: false },
  { id: "other", name: "Other", icon: "DotsHorizontal", color: "slate", featured: false },
];

function normalizePlanKind(kind: string | null | undefined): "personal" | "holiday" | "carnival" {
  const normalized = String(kind ?? "").trim().toLowerCase();
  if (normalized === "holiday" || normalized === "carnival") return normalized;
  return "personal";
}

function getPlanSpecificExpenseCategories(kind: "personal" | "holiday" | "carnival"): ExpenseCategoryDefinition[] {
  if (kind === "holiday") return HOLIDAY_ONLY_EXPENSE_CATEGORIES;
  if (kind === "carnival") return CARNIVAL_ONLY_EXPENSE_CATEGORIES;
  return PERSONAL_ONLY_EXPENSE_CATEGORIES;
}

export function getExpenseCategoryDefinitionsForPlanKind(kind: string | null | undefined): ExpenseCategoryDefinition[] {
  const normalizedKind = normalizePlanKind(kind);
  const byName = new Map<string, ExpenseCategoryDefinition>();

  for (const category of BASE_EXPENSE_CATEGORIES) {
    byName.set(category.name.toLowerCase(), category);
  }

  for (const category of getPlanSpecificExpenseCategories(normalizedKind)) {
    byName.set(category.name.toLowerCase(), category);
  }

  return Array.from(byName.values()).sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export function getExpenseCategoryBreakdownsForPlanKind(kind: string | null | undefined): ExpenseCategoryBreakdown[] {
  return getExpenseCategoryDefinitionsForPlanKind(kind).map((category) => ({
    categoryId: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    total: 0,
    paidTotal: 0,
    paidCount: 0,
    totalCount: 0,
  }));
}