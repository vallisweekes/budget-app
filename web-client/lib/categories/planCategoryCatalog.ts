import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { prisma } from "@/lib/prisma";

type PlanCategoryDefinition = {
  id: string;
  name: string;
};

const BASE_PLAN_CATEGORIES: PlanCategoryDefinition[] = [
  { id: "carnival", name: "Carnival" },
  { id: "business", name: "Business Trip" },
  { id: "childcare", name: "Childcare" },
  { id: "custom", name: "Custom" },
  { id: "entertainment", name: "Entertainment" },
  { id: "food", name: "Food & Dining" },
  { id: "holiday", name: "Holiday" },
  { id: "housing", name: "Housing" },
  { id: "insurance", name: "Insurance" },
  { id: "investments", name: "Investments" },
  { id: "clothing", name: "Clothing" },
  { id: "personal", name: "Personal Care" },
  { id: "savings", name: "Savings" },
  { id: "subscriptions", name: "Subscriptions" },
  { id: "transport", name: "Transport" },
  { id: "utilities", name: "Utilities" },
];

const PERSONAL_ONLY_PLAN_CATEGORIES: PlanCategoryDefinition[] = [
  { id: "fees_and_charges", name: "Fees & Charges" },
];

const HOLIDAY_ONLY_PLAN_CATEGORIES: PlanCategoryDefinition[] = [
  { id: "activities", name: "Activities" },
  { id: "tours", name: "Tours" },
  { id: "spending_money", name: "Spending Money" },
  { id: "accommodation", name: "Accommodation" },
  { id: "flights", name: "Flights" },
  { id: "rental", name: "Rental" },
];

const CARNIVAL_ONLY_PLAN_CATEGORIES: PlanCategoryDefinition[] = [
  { id: "costumes", name: "Costumes" },
  { id: "events_tickets", name: "Events Tickets" },
  { id: "jouvert_package", name: "Jouvert Package" },
  { id: "transport", name: "Transport" },
  { id: "accommodation", name: "Accommodation" },
  { id: "flights", name: "Flights" },
  { id: "spending_money", name: "Spending Money" },
  { id: "drinks_and_food", name: "Drinks and Food" },
  { id: "rental", name: "Rental" },
  { id: "other", name: "Other" },
];

function normalizePlanKind(kind: string | null | undefined): "personal" | "holiday" | "carnival" {
  const normalized = String(kind ?? "").trim().toLowerCase();
  if (normalized === "holiday" || normalized === "carnival") return normalized;
  return "personal";
}

function getPlanSpecificCategories(kind: "personal" | "holiday" | "carnival"): PlanCategoryDefinition[] {
  if (kind === "holiday") return HOLIDAY_ONLY_PLAN_CATEGORIES;
  if (kind === "carnival") return CARNIVAL_ONLY_PLAN_CATEGORIES;
  return PERSONAL_ONLY_PLAN_CATEGORIES;
}

export function getPlanCategoryCatalog(kind: string | null | undefined): PlanCategoryDefinition[] {
  const byName = new Map<string, PlanCategoryDefinition>();
  for (const category of BASE_PLAN_CATEGORIES) {
    byName.set(category.name.toLowerCase(), category);
  }
  for (const category of getPlanSpecificCategories(normalizePlanKind(kind))) {
    byName.set(category.name.toLowerCase(), category);
  }
  return Array.from(byName.values());
}

export async function resolveCanonicalCategoryIdForBudgetPlanName(params: {
  budgetPlanId: string;
  categoryName: string;
}): Promise<string | null> {
  const categoryName = params.categoryName.trim();
  if (!categoryName) return null;

  const plan = await prisma.budgetPlan.findUnique({
    where: { id: params.budgetPlanId },
    select: { kind: true },
  });

  const match = getPlanCategoryCatalog(plan?.kind).find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  return match?.id ?? null;
}

export async function resolvePlanMappedCategoryId(params: {
  budgetPlanId: string;
  categoryId: string | null;
}): Promise<string | null> {
  const rawCategoryId = params.categoryId?.trim() ?? "";
  if (!rawCategoryId) return null;

  const direct = await prisma.category.findFirst({
    where: { id: rawCategoryId, budgetPlanId: params.budgetPlanId },
    select: { id: true },
  });
  if (direct) return direct.id;

  const plan = await prisma.budgetPlan.findUnique({
    where: { id: params.budgetPlanId },
    select: { kind: true },
  });

  const mapped = getPlanCategoryCatalog(plan?.kind).find((category) => category.id === rawCategoryId);
  if (!mapped) return rawCategoryId;

  const findByName = () => prisma.category.findFirst({
    where: {
      budgetPlanId: params.budgetPlanId,
      name: { equals: mapped.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  let category = await findByName();
  if (category) return category.id;

  await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: params.budgetPlanId });
  category = await findByName();
  return category?.id ?? rawCategoryId;
}