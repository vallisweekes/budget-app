import { prisma } from "@/lib/prisma";

export const MOBILE_AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type MobileAuthSessionDelegate = {
  create: (args: Record<string, unknown>) => Promise<{ id: string; expiresAt: Date }>;
  updateMany: (args: Record<string, unknown>) => Promise<unknown>;
  findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
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

  const row = await mobileAuthSessionDelegate(prisma).create({
    data: {
      userId: params.userId,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return {
    sessionId: row.id,
    expiresAt: row.expiresAt,
  };
}

export async function revokeMobileAuthSession(params: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  try {
    await mobileAuthSessionDelegate(prisma).updateMany({
      where: {
        id: params.sessionId,
        userId: params.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
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
