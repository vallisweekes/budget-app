import { prisma } from "@/lib/prisma";

import { deriveLegacyOnboardingProfile, mapStoredProfile, mergeMissingProfileFields, normalizeReturnedProfile } from "./profile";
import { COMMON_OCCUPATIONS, EMPTY_ONBOARDING_PROFILE } from "./types";
import { isPotentialLegacyExpenseSchemaError, isPrismaValidationError, onboardingDelegate, prismaUserHasField } from "./utils";

export async function createOnboardingForNewUser(userId: string) {
  await onboardingDelegate(prisma).create({ data: { userId, status: "started" } });
}

async function getPreferredBudgetPlanId(userId: string): Promise<string | null> {
  const personal = await prisma.budgetPlan.findFirst({ where: { userId, kind: "personal" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (personal) return personal.id;
  const mostRecent = await prisma.budgetPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return mostRecent?.id ?? null;
}

async function getUserIsOnboarded(userId: string): Promise<boolean | null> {
  if (!prismaUserHasField("isOnboarded")) return null;
  try {
    const delegate = (prisma as unknown as {
      user: { findUnique: (args: { where: { id: string }; select: { isOnboarded: true } }) => Promise<{ isOnboarded?: unknown } | null> };
    }).user;
    const user = await delegate.findUnique({ where: { id: userId }, select: { isOnboarded: true } });
    return typeof user?.isOnboarded === "boolean" ? user.isOnboarded : null;
  } catch (error) {
    if (isPrismaValidationError(error, "isOnboarded")) return null;
    throw error;
  }
}

async function setUserIsOnboardedTrue(userId: string) {
  if (!prismaUserHasField("isOnboarded")) return;
  try {
    const delegate = (prisma as unknown as {
      user: { update: (args: { where: { id: string }; data: { isOnboarded: boolean } }) => Promise<unknown> };
    }).user;
    await delegate.update({ where: { id: userId }, data: { isOnboarded: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isPrismaValidationError(error, "isOnboarded") || /isOnboarded/i.test(message)) return;
    throw error;
  }
}

async function hasBasicSetup(preferredPlanId: string | null): Promise<boolean> {
  if (!preferredPlanId) return false;
  const [income, expense] = await Promise.all([
    prisma.income.findFirst({ where: { budgetPlanId: preferredPlanId }, select: { id: true } }),
    (async () => {
      try {
        return await prisma.expense.findFirst({ where: { budgetPlanId: preferredPlanId, isAllocation: false }, select: { id: true } });
      } catch (error) {
        if (!isPrismaValidationError(error, "isAllocation") && !isPotentialLegacyExpenseSchemaError(error)) throw error;
        return prisma.expense.findFirst({ where: { budgetPlanId: preferredPlanId }, select: { id: true } });
      }
    })(),
  ]);
  return Boolean(income) && Boolean(expense);
}

function shouldDeriveLegacyProfile(profile: ReturnType<typeof mapStoredProfile> | null): boolean {
  if (!profile) return true;

  return [
    profile.payDay,
    profile.payFrequency,
    profile.billFrequency,
    profile.monthlySalary,
    profile.expenseOneName,
    profile.allowanceAmount,
    profile.hasDebtsToManage,
    profile.debtAmount,
  ].some((value) => value == null || (typeof value === "string" && value.trim().length === 0));
}

export async function getOnboardingForUser(userId: string) {
  const [profile, preferredPlanId, userIsOnboarded] = await Promise.all([
    onboardingDelegate(prisma).findUnique({ where: { userId } }),
    getPreferredBudgetPlanId(userId),
    getUserIsOnboarded(userId),
  ]);
  const hasBasics = await hasBasicSetup(preferredPlanId);
  const shouldBypassOnboarding = hasBasics || userIsOnboarded === true;
  const mappedProfile = profile ? mapStoredProfile(profile) : null;
  const derivedLegacyProfile = shouldBypassOnboarding && shouldDeriveLegacyProfile(mappedProfile)
    ? await deriveLegacyOnboardingProfile(userId, preferredPlanId)
    : EMPTY_ONBOARDING_PROFILE;

  if (shouldBypassOnboarding) {
    if (userIsOnboarded !== true && hasBasics) await setUserIsOnboardedTrue(userId);
    if (!profile) {
      return {
        required: false,
        completed: true,
        profile: normalizeReturnedProfile(mergeMissingProfileFields(EMPTY_ONBOARDING_PROFILE, derivedLegacyProfile)),
        occupations: COMMON_OCCUPATIONS,
      };
    }
    return {
      required: false,
      completed: profile.status === "completed",
      profile: normalizeReturnedProfile(mergeMissingProfileFields(mappedProfile ?? EMPTY_ONBOARDING_PROFILE, derivedLegacyProfile)),
      occupations: COMMON_OCCUPATIONS,
    };
  }

  if (!profile) {
    await onboardingDelegate(prisma).create({ data: { userId, status: "started" } });
    return { required: true, completed: false, profile: EMPTY_ONBOARDING_PROFILE, occupations: COMMON_OCCUPATIONS };
  }

  return {
    required: profile.status !== "completed",
    completed: profile.status === "completed",
    profile: normalizeReturnedProfile(mapStoredProfile(profile)),
    occupations: COMMON_OCCUPATIONS,
  };
}