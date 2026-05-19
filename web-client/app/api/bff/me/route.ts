import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/api/bffAuth";
import { isValidEmail, normalizeEmail } from "@/lib/helpers/email";
import { sendEmailVerificationEmail } from "@/lib/auth/emailVerification";
import { runOnboardingRepairPass } from "@/lib/onboarding";
import { touchMobileAuthSessionAndDetectFirstSeen } from "@/lib/mobileAuthSessions";
import { getJsonCache, setJsonCache } from "@/lib/cache/redisJsonCache";
import { isRedisConfigured } from "@/lib/redis";
import {
  getProfileCacheKey,
  PROFILE_CACHE_TTL_SECONDS,
  invalidateProfileCache,
} from "@/lib/cache/profileCache";
import { buildProfileResponse } from "@/lib/profileResponse";
import { bestEffortWithin } from "@/lib/bestEffortWithin";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
