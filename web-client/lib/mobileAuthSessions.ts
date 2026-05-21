import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";

export const MOBILE_AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type MobileAuthSessionDelegate = {
  create: (args: Record<string, unknown>) => Promise<{ id: string; expiresAt: Date }>;
  updateMany: (args: Record<string, unknown>) => Promise<unknown>;
  findFirst: (args: Record<string, unknown>) => Promise<{ id: string; createdAt?: Date | null; lastSeenAt?: Date | null } | null>;
};

export type MobileAuthSessionTouchState = {
  isFirstSeen: boolean;
  createdAt: Date | null;
  previousLastSeenAt: Date | null;
};

function mobileAuthSessionDelegate(client: unknown): MobileAuthSessionDelegate {
  return (client as { mobileAuthSession: MobileAuthSessionDelegate }).mobileAuthSession;
}

function isSessionTableMissing(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return message.includes("MobileAuthSession") || message.includes("P2021") || message.includes("does not exist");
}

export async function createMobileAuthSession(params: {
  userId: string;
  maxAgeSeconds?: number;
}): Promise<{ sessionId: string; expiresAt: Date }> {
  const maxAgeSeconds = Number.isFinite(params.maxAgeSeconds) && Number(params.maxAgeSeconds) > 0
    ? Math.floor(Number(params.maxAgeSeconds))
    : MOBILE_AUTH_MAX_AGE_SECONDS;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  try {
    const row = await withPrismaRetry(
      () => mobileAuthSessionDelegate(prisma).create({
        data: {
          userId: params.userId,
          expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      }),
      { retries: 2, delayMs: 120 },
    );

    return {
      sessionId: row.id,
      expiresAt: row.expiresAt,
    };
  } catch (error) {
    if (!isSessionTableMissing(error)) throw error;

    return {
      sessionId: randomUUID(),
      expiresAt,
    };
  }
}

export async function revokeMobileAuthSession(params: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  try {
    await withPrismaRetry(
      () => mobileAuthSessionDelegate(prisma).updateMany({
        where: {
          id: params.sessionId,
          userId: params.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      { retries: 2, delayMs: 120 },
    );
  } catch (error) {
    if (!isSessionTableMissing(error)) throw error;
  }
}

export async function isMobileAuthSessionActive(params: {
  sessionId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const row = await mobileAuthSessionDelegate(prisma).findFirst({
      where: {
        id: params.sessionId,
        userId: params.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return Boolean(row);
  } catch (error) {
    if (isSessionTableMissing(error)) return true;
    throw error;
  }
}

export async function touchMobileAuthSessionAndGetState(params: {
  sessionId: string;
  userId: string;
}): Promise<MobileAuthSessionTouchState> {
  try {
    const row = await mobileAuthSessionDelegate(prisma).findFirst({
      where: {
        id: params.sessionId,
        userId: params.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, createdAt: true, lastSeenAt: true },
    });

    if (!row) {
      return {
        isFirstSeen: false,
        createdAt: null,
        previousLastSeenAt: null,
      };
    }

    const createdAt = row.createdAt instanceof Date ? row.createdAt : null;
    const previousLastSeenAt = row.lastSeenAt instanceof Date ? row.lastSeenAt : null;
    const createdAtMs = createdAt?.getTime() ?? 0;
    const lastSeenAtMs = previousLastSeenAt?.getTime() ?? 0;
    const isFirstSeen = createdAtMs > 0 && lastSeenAtMs > 0 && Math.abs(lastSeenAtMs - createdAtMs) <= 2_000;

    await withPrismaRetry(
      () => mobileAuthSessionDelegate(prisma).updateMany({
        where: {
          id: params.sessionId,
          userId: params.userId,
          revokedAt: null,
        },
        data: {
          lastSeenAt: new Date(),
        },
      }),
      { retries: 2, delayMs: 120 },
    );

    return {
      isFirstSeen,
      createdAt,
      previousLastSeenAt,
    };
  } catch (error) {
    if (isSessionTableMissing(error)) {
      return {
        isFirstSeen: true,
        createdAt: null,
        previousLastSeenAt: null,
      };
    }
    throw error;
  }
}

export async function touchMobileAuthSessionAndDetectFirstSeen(params: {
  sessionId: string;
  userId: string;
}): Promise<boolean> {
  return (await touchMobileAuthSessionAndGetState(params)).isFirstSeen;
}
