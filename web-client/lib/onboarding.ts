import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForBudgetPlan } from "@/lib/categories/defaultCategories";
import { suggestCategoryNameForExpense } from "@/lib/expenses/expenseCategorizer";
import { ensureUkMobileProviderMappingsSeeded } from "@/lib/expenses/providerMappings";
import { normalizePayFrequency, resolveActivePayPeriodWindow } from "@/lib/payPeriods";
import { getExpensePeriodKey, getIncomePeriodKey } from "@/lib/helpers/periodKey";

export const COMMON_OCCUPATIONS = [
  "Accountant",
  "Administrator",
  "Chef",
  "Construction",
  "Customer Service",
  "Designer",
  "Driver",
  "Electrician",
  "Engineer",
  "Healthcare Worker",
  "Hospitality",
  "Lawyer",
  "Manager",
  "Mechanic",
  "Nurse",
  "Retail",
  "Sales",
  "Self-employed",
  "Software Developer",
  "Teacher",
  "Other",
] as const;

export type OnboardingGoalInput = "improve_savings" | "manage_debts" | "track_spending" | "build_budget";

export type OnboardingInput = {
  mainGoal?: OnboardingGoalInput | null;
  mainGoals?: OnboardingGoalInput[] | null;
  occupation?: string | null;
  occupationOther?: string | null;
  payDay?: number | null;
  payFrequency?: "monthly" | "every_2_weeks" | "weekly" | null;
  billFrequency?: "monthly" | "every_2_weeks" | null;
  monthlySalary?: number | null;
  planningYears?: number | null;
  savingsGoalAmount?: number | null;
  savingsGoalYear?: number | null;
  expenseOneName?: string | null;
  expenseOneAmount?: number | null;
  expenseTwoName?: string | null;
  expenseTwoAmount?: number | null;
  expenseThreeName?: string | null;
  expenseThreeAmount?: number | null;
  expenseFourName?: string | null;
  expenseFourAmount?: number | null;
  hasAllowance?: boolean | null;
  allowanceAmount?: number | null;
  hasDebtsToManage?: boolean | null;
  debtAmount?: number | null;
  debtNotes?: string | null;
};

type OnboardingProfileRecord = {
  status: "started" | "completed";
  mainGoal: OnboardingGoalInput | null;
  mainGoals: OnboardingGoalInput[];
  occupation: string | null;
  occupationOther: string | null;
  payDay: number | null;
  payFrequency: "monthly" | "every_2_weeks" | "weekly" | null;
  billFrequency: "monthly" | "every_2_weeks" | null;
  monthlySalary: unknown;
  planningYears: number | null;
  savingsGoalAmount: unknown;
  savingsGoalYear: number | null;
  expenseOneName: string | null;
  expenseOneAmount: unknown;
  expenseTwoName: string | null;
  expenseTwoAmount: unknown;
  expenseThreeName: string | null;
  expenseThreeAmount: unknown;
  expenseFourName: string | null;
  expenseFourAmount: unknown;
  hasAllowance: boolean | null;
  allowanceAmount: unknown;
  hasDebtsToManage: boolean | null;
  debtAmount: unknown;
  debtNotes: string | null;
  generatedPlanId: string | null;
};

function isPrismaValidationError(err: unknown, contains: string): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { name?: unknown; message?: unknown };
  return (
    maybe.name === "PrismaClientValidationError" &&
    typeof maybe.message === "string" &&
    maybe.message.includes(contains)
  );
}

function prismaUserHasField(fieldName: string): boolean {
  try {
    const runtimeDataModel = (prisma as unknown as {
      _runtimeDataModel?: {
        models?: Record<string, { fields?: Array<{ name?: string }> }>;
      };
    })._runtimeDataModel;
    const fields = runtimeDataModel?.models?.User?.fields;
    if (!Array.isArray(fields)) return false;
    return fields.some((f) => f?.name === fieldName);
  } catch {
    return false;
  }
}

function isOnboardingGoal(value: unknown): value is OnboardingGoalInput {
  return value === "improve_savings" || value === "manage_debts" || value === "track_spending" || value === "build_budget";
}

function cleanGoals(input: unknown): OnboardingGoalInput[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned = input.filter(isOnboardingGoal);
  if (!cleaned.length) return [];
  return Array.from(new Set(cleaned));
}

type OnboardingDelegate = {
  create: (args: Record<string, unknown>) => Promise<unknown>;
  findUnique: (args: Record<string, unknown>) => Promise<OnboardingProfileRecord | null>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};

function onboardingDelegate(client: unknown): OnboardingDelegate {
  return (client as { userOnboardingProfile: OnboardingDelegate }).userOnboardingProfile;
}

function toAmount(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Number(value.toFixed(2)));
}

function clampPayDay(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  const rounded = Math.trunc(value);
  return Math.max(1, Math.min(31, rounded));
}

function cleanPayFrequency(value: unknown): "monthly" | "every_2_weeks" | "weekly" | null {
  return value === "monthly" || value === "every_2_weeks" || value === "weekly" ? value : null;
}

function cleanBillFrequency(value: unknown): "monthly" | "every_2_weeks" | null {
  return value === "monthly" || value === "every_2_weeks" ? value : null;
}

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampIntRange(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.trunc(value);
  return Math.max(min, Math.min(max, rounded));
}

function buildForwardSeedMonths(startDate: Date, planningYears: number): Array<{ month: number; year: number }> {
  const safeYears = Math.max(1, Math.min(30, Math.trunc(planningYears)));
  const count = safeYears * 12;
  const startMonthIndex = startDate.getMonth();
  const startYear = startDate.getFullYear();
  const out: Array<{ month: number; year: number }> = [];
  for (let offset = 0; offset < count; offset += 1) {
    const absolute = startMonthIndex + offset;
    out.push({
      month: (absolute % 12) + 1,
      year: startYear + Math.floor(absolute / 12),
    });
  }
  return out;
}

export async function createOnboardingForNewUser(userId: string) {
  await onboardingDelegate(prisma).create({
    data: {
      userId,
      status: "started",
    },
  });
}

export async function getOnboardingForUser(userId: string) {
  const profile = await onboardingDelegate(prisma).findUnique({
    where: { userId },
  });

  const getPreferredBudgetPlanId = async (): Promise<string | null> => {
    // Prefer "personal" (matches existing default-plan logic elsewhere).
    const personal = await prisma.budgetPlan.findFirst({
      where: { userId, kind: "personal" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (personal) return personal.id;

    const mostRecent = await prisma.budgetPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return mostRecent?.id ?? null;
  };

  const preferredPlanId = await getPreferredBudgetPlanId();

  const getUserIsOnboarded = async (): Promise<boolean | null> => {
    if (!prismaUserHasField("isOnboarded")) return null;
    try {
      type FindUniqueArgs = { where: { id: string }; select: { isOnboarded: true } };
      type FindUniqueResult = { isOnboarded?: unknown } | null;
      const delegate = (prisma as unknown as {
        user: { findUnique: (args: FindUniqueArgs) => Promise<FindUniqueResult> };
      }).user;

      const user = await delegate.findUnique({ where: { id: userId }, select: { isOnboarded: true } });
      return typeof user?.isOnboarded === "boolean" ? user.isOnboarded : null;
    } catch (err) {
      if (isPrismaValidationError(err, "isOnboarded")) return null;
      throw err;
    }
  };

  const userIsOnboarded = await getUserIsOnboarded();

  const setUserIsOnboardedTrue = async (): Promise<void> => {
    if (!prismaUserHasField("isOnboarded")) return;
    try {
      type UpdateArgs = { where: { id: string }; data: { isOnboarded: boolean } };
      type UpdateResult = unknown;
      const delegate = (prisma as unknown as {
        user: { update: (args: UpdateArgs) => Promise<UpdateResult> };
      }).user;
      await delegate.update({ where: { id: userId }, data: { isOnboarded: true } });
    } catch (err) {
      if (isPrismaValidationError(err, "isOnboarded")) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (/isOnboarded/i.test(msg)) return;
      throw err;
    }
  };

  const hasBasicSetup = async (): Promise<boolean> => {
    if (!preferredPlanId) return false;
    const [income, expense] = await Promise.all([
      prisma.income.findFirst({ where: { budgetPlanId: preferredPlanId }, select: { id: true } }),
      (async () => {
        try {
          return await prisma.expense.findFirst({
            where: { budgetPlanId: preferredPlanId, isAllocation: false },
            select: { id: true },
          });
        } catch (err) {
          if (!isPrismaValidationError(err, "isAllocation")) throw err;
          return prisma.expense.findFirst({ where: { budgetPlanId: preferredPlanId }, select: { id: true } });
        }
      })(),
    ]);
    return Boolean(income) && Boolean(expense);
  };

  const hasBasics = await hasBasicSetup();
  const shouldBypassOnboarding = hasBasics || userIsOnboarded === true;

  // Fully configured users (income + expenses exist) should never be blocked by onboarding,
  // even if they predate the onboarding profile.
  if (shouldBypassOnboarding) {
    if (userIsOnboarded !== true && hasBasics) {
      await setUserIsOnboardedTrue();
    }
    if (!profile) {
      return {
        required: false,
        completed: false,
        profile: null,
        occupations: COMMON_OCCUPATIONS,
      };
    }
    return {
      required: false,
      completed: profile.status === "completed",
      profile: {
        mainGoal: profile.mainGoal,
        mainGoals:
          Array.isArray(profile.mainGoals) && profile.mainGoals.length
            ? profile.mainGoals
            : profile.mainGoal
              ? [profile.mainGoal]
              : [],
        occupation: profile.occupation,
        occupationOther: profile.occupationOther,
        payDay: toNullableNumber(profile.payDay),
        payFrequency: cleanPayFrequency(profile.payFrequency),
        billFrequency: cleanBillFrequency(profile.billFrequency),
        monthlySalary: toNullableNumber(profile.monthlySalary),
        planningYears: toNullableNumber(profile.planningYears),
        savingsGoalAmount: toNullableNumber(profile.savingsGoalAmount),
        savingsGoalYear: toNullableNumber(profile.savingsGoalYear),
        expenseOneName: profile.expenseOneName,
        expenseOneAmount: toNullableNumber(profile.expenseOneAmount),
        expenseTwoName: profile.expenseTwoName,
        expenseTwoAmount: toNullableNumber(profile.expenseTwoAmount),
        expenseThreeName: profile.expenseThreeName,
        expenseThreeAmount: toNullableNumber(profile.expenseThreeAmount),
        expenseFourName: profile.expenseFourName,
        expenseFourAmount: toNullableNumber(profile.expenseFourAmount),
        hasAllowance: profile.hasAllowance,
        allowanceAmount: toNullableNumber(profile.allowanceAmount),
        hasDebtsToManage: profile.hasDebtsToManage,
        debtAmount: toNullableNumber(profile.debtAmount),
        debtNotes: profile.debtNotes,
      },
      occupations: COMMON_OCCUPATIONS,
    };
  }

  const emptyProfile = {
    mainGoal: null,
    mainGoals: [],
    occupation: null,
    occupationOther: null,
    payDay: null,
    payFrequency: null,
    billFrequency: null,
    monthlySalary: null,
    planningYears: null,
    savingsGoalAmount: null,
    savingsGoalYear: null,
    expenseOneName: null,
    expenseOneAmount: null,
    expenseTwoName: null,
    expenseTwoAmount: null,
    expenseThreeName: null,
    expenseThreeAmount: null,
    expenseFourName: null,
    expenseFourAmount: null,
    hasAllowance: null,
    allowanceAmount: null,
    hasDebtsToManage: null,
    debtAmount: null,
    debtNotes: null,
  };

  if (!profile) {
    // No plan => new user: require onboarding.
    // Has plan but no income/expenses => legacy partially-configured user: also require onboarding.
    await onboardingDelegate(prisma).create({
      data: {
        userId,
        status: "started",
      },
    });
    return {
      required: true,
      completed: false,
      profile: emptyProfile,
      occupations: COMMON_OCCUPATIONS,
    };
  }

  return {
    required: profile.status !== "completed",
    completed: profile.status === "completed",
    profile: {
      mainGoal: profile.mainGoal,
      mainGoals:
        Array.isArray(profile.mainGoals) && profile.mainGoals.length
          ? profile.mainGoals
          : profile.mainGoal
            ? [profile.mainGoal]
            : [],
      occupation: profile.occupation,
      occupationOther: profile.occupationOther,
      payDay: toNullableNumber(profile.payDay),
      payFrequency: cleanPayFrequency(profile.payFrequency),
      billFrequency: cleanBillFrequency(profile.billFrequency),
      monthlySalary: toNullableNumber(profile.monthlySalary),
      planningYears: toNullableNumber(profile.planningYears),
      savingsGoalAmount: toNullableNumber(profile.savingsGoalAmount),
      savingsGoalYear: toNullableNumber(profile.savingsGoalYear),
      expenseOneName: profile.expenseOneName,
      expenseOneAmount: toNullableNumber(profile.expenseOneAmount),
      expenseTwoName: profile.expenseTwoName,
      expenseTwoAmount: toNullableNumber(profile.expenseTwoAmount),
      expenseThreeName: profile.expenseThreeName,
      expenseThreeAmount: toNullableNumber(profile.expenseThreeAmount),
      expenseFourName: profile.expenseFourName,
      expenseFourAmount: toNullableNumber(profile.expenseFourAmount),
      hasAllowance: profile.hasAllowance,
      allowanceAmount: toNullableNumber(profile.allowanceAmount),
      hasDebtsToManage: profile.hasDebtsToManage,
      debtAmount: toNullableNumber(profile.debtAmount),
      debtNotes: profile.debtNotes,
    },
    occupations: COMMON_OCCUPATIONS,
  };
}

export async function saveOnboardingDraft(userId: string, input: OnboardingInput) {
  const existing = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!existing) {
    await onboardingDelegate(prisma).create({
      data: {
        userId,
        status: "started",
      },
    });
  }

  const mainGoals = input.mainGoals ? (cleanGoals(input.mainGoals) ?? []) : null;
  const derivedMainGoal: OnboardingGoalInput | null =
    mainGoals && mainGoals.length ? mainGoals[0] : input.mainGoal ?? null;

  const updateData: Record<string, unknown> = {
    mainGoal: derivedMainGoal ?? undefined,
    mainGoals: mainGoals ?? undefined,
    occupation: cleanText(input.occupation),
    occupationOther: cleanText(input.occupationOther),
    payDay: clampPayDay(input.payDay),
    payFrequency: cleanPayFrequency(input.payFrequency),
    billFrequency: cleanBillFrequency(input.billFrequency),
    monthlySalary: toAmount(input.monthlySalary),
    planningYears: clampIntRange(input.planningYears, 1, 30),
    savingsGoalAmount: toAmount(input.savingsGoalAmount),
    savingsGoalYear: clampIntRange(input.savingsGoalYear, 2000, 2200),
    expenseOneName: cleanText(input.expenseOneName),
    expenseOneAmount: toAmount(input.expenseOneAmount),
    expenseTwoName: cleanText(input.expenseTwoName),
    expenseTwoAmount: toAmount(input.expenseTwoAmount),
    expenseThreeName: cleanText(input.expenseThreeName),
    expenseThreeAmount: toAmount(input.expenseThreeAmount),
    expenseFourName: cleanText(input.expenseFourName),
    expenseFourAmount: toAmount(input.expenseFourAmount),
    hasAllowance: input.hasAllowance ?? undefined,
    allowanceAmount: toAmount(input.allowanceAmount),
    hasDebtsToManage: input.hasDebtsToManage ?? undefined,
    debtAmount: toAmount(input.debtAmount),
    debtNotes: cleanText(input.debtNotes),
  };

  try {
    return await onboardingDelegate(prisma).update({
      where: { userId },
      data: updateData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // If Prisma client/schema/DB is out of sync (common during local dev), retry with legacy fields.
    // Examples:
    // - Unknown argument `mainGoals`
    // - Invalid value for enum (e.g. `build_budget` before migration)
    const shouldDropMainGoals =
      /Unknown arg(ument)? `mainGoals`/i.test(message) || /data\.mainGoals/i.test(message);

    const shouldDropBuildBudget =
      /build_budget/i.test(message) && /enum|expected|invalid value/i.test(message);

    const shouldDropExtraBills =
      /Unknown arg(ument)? `expenseThreeName`/i.test(message) ||
      /Unknown arg(ument)? `expenseThreeAmount`/i.test(message) ||
      /Unknown arg(ument)? `expenseFourName`/i.test(message) ||
      /Unknown arg(ument)? `expenseFourAmount`/i.test(message) ||
      /data\.expenseThreeName/i.test(message) ||
      /data\.expenseThreeAmount/i.test(message) ||
      /data\.expenseFourName/i.test(message) ||
      /data\.expenseFourAmount/i.test(message);

    const shouldDropPaySetup =
      /Unknown arg(ument)? `payDay`/i.test(message) ||
      /Unknown arg(ument)? `payFrequency`/i.test(message) ||
      /Unknown arg(ument)? `billFrequency`/i.test(message) ||
      /data\.payDay/i.test(message) ||
      /data\.payFrequency/i.test(message) ||
      /data\.billFrequency/i.test(message);

    const shouldDropPlanningProjection =
      /Unknown arg(ument)? `planningYears`/i.test(message) ||
      /Unknown arg(ument)? `savingsGoalAmount`/i.test(message) ||
      /Unknown arg(ument)? `savingsGoalYear`/i.test(message) ||
      /data\.planningYears/i.test(message) ||
      /data\.savingsGoalAmount/i.test(message) ||
      /data\.savingsGoalYear/i.test(message);

    if (!shouldDropMainGoals && !shouldDropBuildBudget && !shouldDropExtraBills && !shouldDropPaySetup && !shouldDropPlanningProjection) throw error;

    const retryData: Record<string, unknown> = { ...updateData };

    if (shouldDropMainGoals) {
      delete retryData.mainGoals;
    }

    if (shouldDropExtraBills) {
      delete retryData.expenseThreeName;
      delete retryData.expenseThreeAmount;
      delete retryData.expenseFourName;
      delete retryData.expenseFourAmount;
    }

    if (shouldDropPaySetup) {
      delete retryData.payDay;
      delete retryData.payFrequency;
      delete retryData.billFrequency;
    }

    if (shouldDropPlanningProjection) {
      delete retryData.planningYears;
      delete retryData.savingsGoalAmount;
      delete retryData.savingsGoalYear;
    }

    if (shouldDropBuildBudget) {
      if (retryData.mainGoal === "build_budget") {
        delete retryData.mainGoal;
      }
      if (Array.isArray(retryData.mainGoals)) {
        const filtered = (retryData.mainGoals as unknown[]).filter((g) => g !== "build_budget");
        retryData.mainGoals = filtered;
        if (!filtered.length) delete retryData.mainGoals;
      }
    }

    return onboardingDelegate(prisma).update({
      where: { userId },
      data: retryData,
    });
  }
}

async function ensurePersonalPlan(userId: string): Promise<{ id: string; createdAt: Date }> {
  const existing = await prisma.budgetPlan.findFirst({
    where: { userId, kind: "personal" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  if (existing) return existing;

  const created = await prisma.budgetPlan.create({
    data: {
      userId,
      kind: "personal",
      name: "Personal",
    },
    select: { id: true, createdAt: true },
  });

  await ensureDefaultCategoriesForBudgetPlan({ budgetPlanId: created.id });
  return created;
}

export async function completeOnboarding(userId: string) {
  await ensureUkMobileProviderMappingsSeeded();

  const profile = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!profile) {
    throw new Error("Onboarding profile not found. Save onboarding draft first.");
  }

  const budgetPlan = await ensurePersonalPlan(userId);
  const budgetPlanId = budgetPlan.id;

  const planningYears = clampIntRange(toNullableNumber(profile.planningYears), 1, 30) ?? 10;
  const savingsGoalAmount = Number(profile.savingsGoalAmount ?? 0);
  const savingsGoalYear = clampIntRange(toNullableNumber(profile.savingsGoalYear), 2000, 2200);

  const year = new Date().getFullYear();
  const payDay = clampPayDay(toNullableNumber(profile.payDay));

  const now = new Date();
  const activePayPeriod = resolveActivePayPeriodWindow({
    now,
    payDate: payDay ?? 1,
    payFrequency: normalizePayFrequency(profile.payFrequency),
    planCreatedAt: budgetPlan.createdAt,
  });
  const activePeriodMonth = activePayPeriod.start.getUTCMonth() + 1;
  const activePeriodYear = activePayPeriod.start.getUTCFullYear();

  const seededIncomePeriods = buildForwardSeedMonths(now, planningYears);
  const seededExpensePeriods = Array.from(
    new Map(
      [
        { month: now.getMonth() + 1, year: now.getFullYear() },
        { month: activePeriodMonth, year: activePeriodYear },
      ].map((entry) => [`${entry.year}-${entry.month}`, entry])
    ).values()
  );

  const categories = await prisma.category.findMany({
    where: { budgetPlanId },
    select: { id: true, name: true },
  });
  const availableCategoryNames = categories.map((c) => c.name);
  const categoryIdByLowerName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id] as const));

  const expenseSeedsRaw: Array<{ name: string | null; amount: number; fallbackName: string }> = [
    { name: profile.expenseOneName, amount: Number(profile.expenseOneAmount ?? 0), fallbackName: "Bill 1" },
    { name: profile.expenseTwoName, amount: Number(profile.expenseTwoAmount ?? 0), fallbackName: "Bill 2" },
    { name: profile.expenseThreeName, amount: Number(profile.expenseThreeAmount ?? 0), fallbackName: "Bill 3" },
    { name: profile.expenseFourName, amount: Number(profile.expenseFourAmount ?? 0), fallbackName: "Bill 4" },
  ];

  const expenseSeeds = await Promise.all(
    expenseSeedsRaw.map(async (item) => {
      if (item.amount <= 0) return { ...item, resolvedName: null as string | null, categoryId: null as string | null };

      const cleanedName = cleanText(item.name);
      const resolvedName = cleanedName || item.fallbackName;

      const suggestedName = await suggestCategoryNameForExpense({
        expenseName: resolvedName,
        availableCategories: availableCategoryNames,
      });
      const categoryId = suggestedName ? categoryIdByLowerName.get(suggestedName.toLowerCase()) ?? null : null;
      return { ...item, resolvedName, categoryId };
    })
  );

  await prisma.$transaction(async (tx) => {
    const salary = Number(profile.monthlySalary ?? 0);

    if (salary > 0) {
      const seededPayFrequency = normalizePayFrequency(profile.payFrequency);
      for (const period of seededIncomePeriods) {
        const existingSalary = await tx.income.findFirst({
          where: { budgetPlanId, month: period.month, year: period.year },
          select: { id: true },
        });
        if (existingSalary) continue;

        await tx.income.create({
          data: {
            budgetPlanId,
            name: "Salary",
            amount: salary,
            month: period.month,
            year: period.year,
            periodKey: getIncomePeriodKey({ year: period.year, month: period.month }, payDay ?? 1, seededPayFrequency),
          },
        });
      }
    }

    const allowance = Number(profile.allowanceAmount ?? 0);
    await tx.budgetPlan.update({
      where: { id: budgetPlanId },
      data: {
        payDate: payDay ?? undefined,
        budgetHorizonYears: planningYears,
        monthlyAllowance: profile.hasAllowance ? allowance : 0,
      },
    });

    for (const period of seededExpensePeriods) {
      for (const item of expenseSeeds) {
        if (!item.resolvedName || item.amount <= 0) continue;
        const exists = await tx.expense.findFirst({
          where: { budgetPlanId, month: period.month, year: period.year, name: item.resolvedName },
          select: { id: true },
        });
        if (exists) continue;

        const expDueDate = payDay
              ? new Date(
                Date.UTC(
                  period.year,
                  period.month - 1,
                  Math.min(payDay, new Date(Date.UTC(period.year, period.month, 0)).getUTCDate())
                )
              )
              : undefined;
        await tx.expense.create({
          data: {
            budgetPlanId,
            name: item.resolvedName,
            amount: item.amount,
            month: period.month,
            year: period.year,
            dueDate: expDueDate,
            paid: false,
            paidAmount: 0,
            isAllocation: false,
            categoryId: item.categoryId ?? undefined,
            periodKey: getExpensePeriodKey({ dueDate: expDueDate ?? null, year: period.year, month: period.month }, payDay ?? 1),
          },
        });
      }
    }

    const debtAmount = Number(profile.debtAmount ?? 0);
    if (profile.hasDebtsToManage && debtAmount > 0) {
      const hasDebt = await tx.debt.findFirst({
        where: { budgetPlanId },
        select: { id: true },
      });
      if (!hasDebt) {
        await tx.debt.create({
          data: {
            budgetPlanId,
            name: profile.debtNotes || "Debt to manage",
            type: "loan",
            initialBalance: debtAmount,
            currentBalance: debtAmount,
            amount: debtAmount,
            paid: false,
            paidAmount: 0,
          },
        });
      }
    }

    const selectedGoals: OnboardingGoalInput[] =
      Array.isArray(profile.mainGoals) && profile.mainGoals.length
        ? profile.mainGoals
        : profile.mainGoal
          ? [profile.mainGoal]
          : [];

    const uniqueGoals = Array.from(new Set(selectedGoals));
    for (const goal of uniqueGoals) {
      // "build_budget" is a useful onboarding intent but doesn't map cleanly to a measurable Goal record.
      if (goal === "build_budget") continue;

      const goalTitle =
        goal === "improve_savings"
          ? "Improve savings"
          : goal === "manage_debts"
            ? "Manage debts better"
            : "Keep track of spending";

      const existingGoal = await tx.goal.findFirst({ where: { budgetPlanId, title: goalTitle }, select: { id: true } });
      if (existingGoal) continue;

      await tx.goal.create({
        data: {
          budgetPlanId,
          title: goalTitle,
          type: "short_term",
          category: goal === "manage_debts" ? "debt" : "savings",
          targetAmount:
            goal === "manage_debts"
              ? debtAmount || 1000
              : savingsGoalAmount > 0
                ? savingsGoalAmount
                : 1000,
          currentAmount: 0,
          targetYear: goal === "manage_debts" ? year : savingsGoalYear ?? year,
        },
      });
    }

    await onboardingDelegate(tx).update({
      where: { userId },
      data: {
        status: "completed",
        completedAt: new Date(),
        generatedPlanId: budgetPlanId,
      },
    });

    // Best-effort: mark user as onboarded so legacy gating can be bypassed.
    try {
      type UpdateArgs = { where: { id: string }; data: { isOnboarded: boolean } };
      type UpdateResult = unknown;
      const delegate = (tx as unknown as { user: { update: (args: UpdateArgs) => Promise<UpdateResult> } }).user;
      await delegate.update({ where: { id: userId }, data: { isOnboarded: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isPrismaValidationError(err, "isOnboarded") || /isOnboarded/i.test(msg)) {
        // Ignore when Prisma client/DB is temporarily out of sync.
      } else {
        throw err;
      }
    }
  });

  return { budgetPlanId };
}

export async function runOnboardingRepairPass(userId: string) {
  await ensureUkMobileProviderMappingsSeeded();

  const profile = await onboardingDelegate(prisma).findUnique({ where: { userId } });
  if (!profile || profile.status !== "completed") return;

  const budgetPlan = (typeof profile.generatedPlanId === "string" && profile.generatedPlanId.trim())
    ? await prisma.budgetPlan.findUnique({
        where: { id: profile.generatedPlanId.trim() },
        select: { id: true, createdAt: true },
      })
    : await ensurePersonalPlan(userId);
  const ensuredBudgetPlan = budgetPlan ?? await ensurePersonalPlan(userId);
  const budgetPlanId = ensuredBudgetPlan.id;

  const now = new Date();
  const planningYears = clampIntRange(toNullableNumber(profile.planningYears), 1, 30) ?? 10;
  const payDay = clampPayDay(toNullableNumber(profile.payDay));
  const payFrequency = normalizePayFrequency(profile.payFrequency);
  const activePayPeriod = resolveActivePayPeriodWindow({
    now,
    payDate: payDay ?? 1,
    payFrequency,
    planCreatedAt: ensuredBudgetPlan.createdAt,
  });
  const activePeriodMonth = activePayPeriod.start.getUTCMonth() + 1;
  const activePeriodYear = activePayPeriod.start.getUTCFullYear();

  const seededIncomePeriods = buildForwardSeedMonths(now, planningYears);
  const seededExpensePeriods = Array.from(
    new Map(
      [
        { month: now.getMonth() + 1, year: now.getFullYear() },
        { month: activePeriodMonth, year: activePeriodYear },
      ].map((entry) => [`${entry.year}-${entry.month}`, entry])
    ).values()
  );

  const expenseSeedsRaw: Array<{ name: string | null; amount: number; fallbackName: string }> = [
    { name: profile.expenseOneName, amount: Number(profile.expenseOneAmount ?? 0), fallbackName: "Bill 1" },
    { name: profile.expenseTwoName, amount: Number(profile.expenseTwoAmount ?? 0), fallbackName: "Bill 2" },
    { name: profile.expenseThreeName, amount: Number(profile.expenseThreeAmount ?? 0), fallbackName: "Bill 3" },
    { name: profile.expenseFourName, amount: Number(profile.expenseFourAmount ?? 0), fallbackName: "Bill 4" },
  ];

  const expenseSeeds = expenseSeedsRaw
    .filter((item) => item.amount > 0)
    .map((item) => ({
      name: cleanText(item.name) || item.fallbackName,
      amount: item.amount,
    }));

  await prisma.$transaction(async (tx) => {
    const salary = Number(profile.monthlySalary ?? 0);

    if (salary > 0) {
      const seededPayFrequency = normalizePayFrequency(profile.payFrequency);
      for (const period of seededIncomePeriods) {
        const existingSalary = await tx.income.findFirst({
          where: { budgetPlanId, month: period.month, year: period.year },
          select: { id: true },
        });
        if (existingSalary) continue;

        await tx.income.create({
          data: {
            budgetPlanId,
            name: "Salary",
            amount: salary,
            month: period.month,
            year: period.year,
            periodKey: getIncomePeriodKey({ year: period.year, month: period.month }, payDay ?? 1, seededPayFrequency),
          },
        });
      }
    }

    if (payDay) {
      await tx.budgetPlan.update({
        where: { id: budgetPlanId },
        data: {
          payDate: payDay,
          budgetHorizonYears: planningYears,
        },
      });
    }

    for (const period of seededExpensePeriods) {
      for (const item of expenseSeeds) {
        const dueDate = payDay
          ? new Date(
            Date.UTC(
              period.year,
              period.month - 1,
              Math.min(payDay, new Date(Date.UTC(period.year, period.month, 0)).getUTCDate())
            )
          )
          : null;

        const existing = await tx.expense.findFirst({
          where: {
            budgetPlanId,
            month: period.month,
            year: period.year,
            name: item.name,
          },
          select: { id: true, dueDate: true },
        });

        if (existing) {
          if (!existing.dueDate && dueDate) {
            await tx.expense.update({
              where: { id: existing.id },
              data: { dueDate },
            });
          }
          continue;
        }

        await tx.expense.create({
          data: {
            budgetPlanId,
            name: item.name,
            amount: item.amount,
            month: period.month,
            year: period.year,
            dueDate: dueDate ?? undefined,
            paid: false,
            paidAmount: 0,
            isAllocation: false,
            periodKey: getExpensePeriodKey({ dueDate, year: period.year, month: period.month }, payDay ?? 1),
          },
        });
      }
    }
  });
}
