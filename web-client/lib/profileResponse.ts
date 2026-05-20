import { prisma } from "@/lib/prisma";
import { getEmailVerificationState } from "@/lib/auth/emailVerification";
import { getOnboardingForUser } from "@/lib/onboarding";
import { deriveBillFrequencyFromPayFrequency, normalizePayFrequency } from "@/lib/payPeriods";
import { getBootstrapSettingsForUser } from "@/lib/settings/bootstrap";
import { listBudgetPlansForUser } from "@/lib/budgetPlans";

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

function normalizeProfileOnMe<T extends { occupation?: unknown; occupationOther?: unknown }>(
  profile: T | null | undefined,
  options: { required: boolean }
): T | null {
  if (!profile) {
    if (options.required) return null;
    return {
      occupation: "Other",
      occupationOther: "Other",
    } as T;
  }

  const occupation = typeof profile.occupation === "string" && profile.occupation.trim().length > 0
    ? profile.occupation
    : "Other";
  const occupationOther = occupation === "Other"
    ? (typeof profile.occupationOther === "string" && profile.occupationOther.trim().length > 0
      ? profile.occupationOther
      : "Other")
    : (typeof profile.occupationOther === "string" ? profile.occupationOther : null);

  return {
    ...profile,
    occupation,
    occupationOther,
  };
}

const EMAIL_VERIFICATION_FALLBACK = {
  status: "not_required" as const,
  emailVerifiedAt: null,
  required: false,
  blocked: false,
  deadlineAt: null,
};

export async function buildProfileResponse(userId: string) {
  const [user, verification, onboarding, onboardingMeta, settings, plans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    getEmailVerificationState(userId).catch((error) => {
      console.error("Failed to resolve email verification state:", error);
      return EMAIL_VERIFICATION_FALLBACK;
    }),
    getOnboardingForUser(userId),
    prisma.userOnboardingProfile.findUnique({
      where: { userId },
      select: {
        status: true,
        completedAt: true,
        updatedAt: true,
        payFrequency: true,
        billFrequency: true,
      },
    }).catch(() => null),
    getBootstrapSettingsForUser({ userId }).catch(() => null),
    listBudgetPlansForUser({ userId }).catch(() => []),
  ]);

  if (!user) return null;

  const setupCompletedAt = latestDate(
    onboardingMeta?.completedAt ?? null,
    onboardingMeta?.status === "completed" ? onboardingMeta?.updatedAt ?? null : null,
  )?.toISOString() ?? null;
  const normalizedOnboarding = {
    required: onboarding.required,
    completed: onboarding.completed,
    profile: normalizeProfileOnMe(onboarding.profile, { required: onboarding.required }),
  };
  const payFrequency = normalizePayFrequency(onboardingMeta?.payFrequency ?? normalizedOnboarding.profile?.payFrequency ?? null);

  return {
    id: user.id,
    username: String(user.name ?? "").trim(),
    email: user.email,
    emailVerifiedAt: verification.emailVerifiedAt?.toISOString() ?? null,
    emailVerificationStatus: verification.status,
    emailVerificationRequired: verification.required,
    emailVerificationBlocked: verification.blocked,
    emailVerificationDeadlineAt: verification.deadlineAt?.toISOString() ?? null,
    onboarding: normalizedOnboarding,
    settings,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      kind: plan.kind,
      payDate: plan.payDate,
      budgetHorizonYears: plan.budgetHorizonYears,
      createdAt: plan.createdAt,
    })),
    accountCreatedAt: user.createdAt?.toISOString() ?? null,
    setupCompletedAt,
    payFrequency,
    billFrequency: deriveBillFrequencyFromPayFrequency(payFrequency),
  };
}