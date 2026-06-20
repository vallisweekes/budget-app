import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/api/bffAuth";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";
import { sendEmailVerificationEmail } from "@/lib/auth/emailVerification";
import { bestEffortWithin } from "@/lib/bestEffortWithin";
import { runOnboardingRepairPass } from "@/lib/onboarding";
import { touchMobileAuthSessionAndGetState } from "@/lib/mobileAuthSessions";
import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import { isRedisConfigured } from "@/lib/redis";
import {
  getProfileCacheKey,
  PROFILE_CACHE_TTL_SECONDS,
  invalidateProfileCache,
} from "@/lib/cache/profileCache";
import { buildProfileResponse } from "@/lib/profileResponse";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

function scheduleMobileSessionRepair(params: {
  userId: string;
  sessionId: string;
}) {
  void bestEffortWithin((async () => {
    try {
      const sessionState = await touchMobileAuthSessionAndGetState({
        userId: params.userId,
        sessionId: params.sessionId,
      });

      let shouldRunRepair = sessionState.isFirstSeen;

      if (!shouldRunRepair) {
        const onboardingState = await prisma.userOnboardingProfile.findUnique({
          where: { userId: params.userId },
          select: { status: true, completedAt: true, updatedAt: true },
        }).catch(() => null);

        const repairReferenceAt = onboardingState?.status === "completed"
          ? latestDate(onboardingState.completedAt, onboardingState.updatedAt)
          : null;
        const lastSeenReferenceAt = sessionState.previousLastSeenAt ?? sessionState.createdAt;

        shouldRunRepair = Boolean(
          repairReferenceAt &&
          lastSeenReferenceAt &&
          lastSeenReferenceAt.getTime() < repairReferenceAt.getTime()
        );
      }

      if (!shouldRunRepair) {
        return;
      }

      await runOnboardingRepairPass(params.userId);
      await invalidateProfileCache(params.userId).catch(() => undefined);
    } catch (error) {
      console.error("Onboarding repair pass failed:", error);
    }
  })(), 250);
}

export async function GET(request: Request) {
  try {
    const identity = await getSessionIdentity(request);
    if (!identity?.userId) return unauthorized();

    const profileCacheKey = getProfileCacheKey(identity.userId);
    const cachedProfile = await getJsonCache<Record<string, unknown>>(profileCacheKey);

    if (identity.sessionId) {
      scheduleMobileSessionRepair({
        userId: identity.userId,
        sessionId: identity.sessionId,
      });
    }

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

    const hasEmail = "email" in body;
    const hasAvatar = "avatarImageDataUrl" in body;

    if (!hasEmail && !hasAvatar) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const rawEmail = hasEmail ? body.email : undefined;
    const normalized = rawEmail == null ? "" : normalizeEmail(String(rawEmail));
    if (hasEmail && normalized && !isValidEmail(normalized)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const rawAvatar = hasAvatar ? body.avatarImageDataUrl : undefined;
    const avatarImageDataUrl = rawAvatar == null ? null : String(rawAvatar);
    if (hasAvatar && avatarImageDataUrl && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(avatarImageDataUrl)) {
      return NextResponse.json({ error: "Invalid avatar image format" }, { status: 400 });
    }
    if (avatarImageDataUrl && avatarImageDataUrl.length > 3_000_000) {
      return NextResponse.json({ error: "Avatar image is too large" }, { status: 413 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailChanged = hasEmail && (currentUser.email ?? null) !== (normalized || null);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: hasEmail ? (normalized || null) : undefined,
        emailVerified: emailChanged ? null : undefined,
        image: hasAvatar ? avatarImageDataUrl : undefined,
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
        void bestEffortWithin(
          sendEmailVerificationEmail(userId, { resetDeadline: true }).catch((error) => {
            console.error("Failed to send verification email after profile update:", error);
          }),
          900,
        );
      }
    }

    void bestEffortWithin(
      invalidateProfileCache(userId).catch(() => undefined),
      250,
    );

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
