import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/api/bffAuth";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";
import { getEmailVerificationState, sendEmailVerificationEmail } from "@/lib/auth/emailVerification";
import { getOnboardingForUser, runOnboardingRepairPass } from "@/lib/onboarding";
import { normalizeBillFrequency, normalizePayFrequency } from "@/lib/payPeriods";
import { touchMobileAuthSessionAndDetectFirstSeen } from "@/lib/mobileAuthSessions";
import { getBootstrapSettingsForUser } from "@/lib/settings/bootstrap";
import { listBudgetPlansForUser } from "@/lib/budgetPlans";
import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import { isRedisConfigured } from "@/lib/redis";
import {
  getProfileCacheKey,
  PROFILE_CACHE_TTL_SECONDS,
  invalidateProfileCache,
} from "@/lib/cache/profileCache";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

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

async function buildProfileResponse(userId: string) {
  const [user, verification, onboarding, onboardingMeta, settings, plans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    getEmailVerificationState(userId),
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
    payFrequency: normalizePayFrequency(onboardingMeta?.payFrequency ?? normalizedOnboarding.profile?.payFrequency ?? null),
    billFrequency: normalizeBillFrequency(onboardingMeta?.billFrequency ?? normalizedOnboarding.profile?.billFrequency ?? null),
  };
}

export async function GET(request: Request) {
  try {
    const identity = await getSessionIdentity(request);
    if (!identity?.userId) return unauthorized();

    // One-time per mobile login session: repair older onboarding test data
    // (missing due dates / missing seeded periods) so Home + Expenses stay consistent.
    if (identity.sessionId) {
      try {
        const firstSeen = await touchMobileAuthSessionAndDetectFirstSeen({
          userId: identity.userId,
          sessionId: identity.sessionId,
        });
        if (firstSeen) {
          await runOnboardingRepairPass(identity.userId);
        }
      } catch (error) {
        console.error("Onboarding repair pass failed:", error);
      }
    }

    const profileCacheKey = getProfileCacheKey(identity.userId);
    const cachedProfile = await getJsonCache<Record<string, unknown>>(profileCacheKey);
    if (cachedProfile) {
      return NextResponse.json(cachedProfile, {
        headers: {
          "x-me-cache": "hit",
          "x-me-redis": isRedisConfigured() ? "configured" : "not-configured",
        },
      });
    }

    const response = await buildProfileResponse(identity.userId);
    if (!response) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await setJsonCache(profileCacheKey, response, PROFILE_CACHE_TTL_SECONDS);

    return NextResponse.json(response, {
      headers: {
        "x-me-cache": "miss",
        "x-me-redis": isRedisConfigured() ? "configured" : "not-configured",
      },
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await getSessionIdentity(request);
    const userId = identity?.userId ?? null;
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!("email" in body)) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const rawEmail = body.email;
    const normalized = rawEmail == null ? "" : normalizeEmail(String(rawEmail));
    if (normalized && !isValidEmail(normalized)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailChanged = (currentUser.email ?? null) !== (normalized || null);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalized || null,
        emailVerified: emailChanged ? null : undefined,
      },
      select: { email: true },
    });

    if (emailChanged) {
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: `email_verification:${userId}`,
        },
      });

      if (updatedUser.email) {
        try {
          await sendEmailVerificationEmail(userId, { resetDeadline: true });
        } catch (error) {
          console.error("Failed to send verification email after profile update:", error);
        }
      }
    }

    await invalidateProfileCache(userId);

    const response = await buildProfileResponse(userId);
    if (!response) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await setJsonCache(getProfileCacheKey(userId), response, PROFILE_CACHE_TTL_SECONDS);

    return NextResponse.json(response, {
      headers: {
        "x-me-cache": "miss",
        "x-me-redis": isRedisConfigured() ? "configured" : "not-configured",
      },
    });
  } catch (error) {
    const message = String((error as { message?: unknown })?.message ?? "");
    if (message.includes("Unique constraint") || message.includes("P2002")) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
