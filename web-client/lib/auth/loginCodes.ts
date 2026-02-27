import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/helpers/username";
import { normalizeEmail, isValidEmail } from "@/lib/helpers/email";
import { withPrismaRetry } from "@/lib/prismaRetry";

const IDENTIFIER_PREFIX = "email_login_code:";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function nowMs(): number {
  return Date.now();
}

function getCodeSecret(): string {
  // Prefer a dedicated secret, but fall back to NEXTAUTH_SECRET so you only
  // have one thing to configure in early environments.
  const secret = String(process.env.LOGIN_CODE_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();
  if (!secret) throw new Error("Server auth is not configured");
  return secret;
}

function normalizePhone(value: string): string {
  // Minimal normalization for now: keep + and digits.
  // (Later you can enforce E.164 or use libphonenumber.)
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const trimmed = raw.replace(/[\s\-().]/g, "");
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

function identifierKeyForUserId(userId: string): string {
  return `${IDENTIFIER_PREFIX}${userId}`;
}

function makeFiveDigitCode(): string {
  // 10000-99999
  return String(Math.floor(10000 + Math.random() * 90000));
}

function hashCode(params: { userId: string; code: string; secret: string }): string {
  const input = `${params.userId}:${params.code}:${params.secret}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

export type LoginCodeIdentifier =
  | { kind: "username"; username: string }
  | { kind: "phone"; phoneNumber: string }
  | { kind: "email"; email: string };

export function parseLoginIdentifier(raw: unknown): LoginCodeIdentifier | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  const normalizedEmail = normalizeEmail(input);
  if (normalizedEmail && isValidEmail(normalizedEmail)) {
    return { kind: "email", email: normalizedEmail };
  }

  // Treat as phone number only when it actually looks like one.
  // (Avoid breaking usernames like "john123".)
  const digitCount = (input.match(/\d/g) ?? []).length;
  const looksLikePhone = input.trim().startsWith("+") || digitCount >= 7;
  if (looksLikePhone) {
    const phoneNumber = normalizePhone(input);
    if (!phoneNumber) return null;
    return { kind: "phone", phoneNumber };
  }

  const username = normalizeUsername(input);
  if (!username) return null;
  return { kind: "username", username };
}

export async function resolveUserForLoginIdentifier(identifier: LoginCodeIdentifier): Promise<{
  id: string;
  username: string;
  email: string | null;
} | null> {
  if (identifier.kind === "username") {
    const user = await withPrismaRetry(
      () =>
        prisma.user.findFirst({
          where: {
            name: {
              equals: identifier.username,
              mode: "insensitive",
            },
          },
          select: { id: true, name: true, email: true },
        }),
      { retries: 2, delayMs: 150 }
    );
    if (!user) return null;
    return {
      id: user.id,
      username: normalizeUsername(String(user.name ?? "")) || identifier.username,
      email: typeof user.email === "string" ? user.email : null,
    };
  }

  if (identifier.kind === "phone") {
    const user = await withPrismaRetry(
      () =>
        prisma.user.findFirst({
          where: {
            phoneNumber: {
              equals: identifier.phoneNumber,
            },
          },
          select: { id: true, name: true, email: true },
        }),
      { retries: 2, delayMs: 150 }
    );
    if (!user) return null;
    return {
      id: user.id,
      username: normalizeUsername(String(user.name ?? "")) || "",
      email: typeof user.email === "string" ? user.email : null,
    };
  }

  const user = await withPrismaRetry(
    () => prisma.user.findUnique({ where: { email: identifier.email }, select: { id: true, name: true, email: true } }),
    { retries: 2, delayMs: 150 }
  );
  if (!user) return null;
  return {
    id: user.id,
    username: normalizeUsername(String(user.name ?? "")) || "",
    email: typeof user.email === "string" ? user.email : null,
  };
}

export async function issueEmailLoginCode(params: { userId: string }): Promise<{
  code: string;
  expiresAt: Date;
  suppressedByCooldown: boolean;
}> {
  const userId = String(params.userId ?? "").trim();
  if (!userId) throw new Error("User id is required");

  const secret = getCodeSecret();
  const identifier = identifierKeyForUserId(userId);

  const now = new Date();
  const nowTime = now.getTime();
  const expiresAt = new Date(nowTime + CODE_TTL_MS);

  // Best-effort cleanup.
  await withPrismaRetry(() => prisma.verificationToken.deleteMany({ where: { identifier, expires: { lt: now } } }), {
    retries: 2,
    delayMs: 150,
  });

  // Naive spam guard (serverless-safe): infer a createdAt from expiresAt - TTL.
  const latest = await withPrismaRetry(
    () => prisma.verificationToken.findFirst({ where: { identifier }, orderBy: { expires: "desc" } }),
    { retries: 2, delayMs: 150 }
  );
  if (latest?.expires instanceof Date) {
    const createdAtMs = latest.expires.getTime() - CODE_TTL_MS;
    const cooldownBoundary = nowMs() - RESEND_COOLDOWN_MS;
    if (createdAtMs > cooldownBoundary && latest.expires.getTime() > nowTime) {
      return { code: "", expiresAt: latest.expires, suppressedByCooldown: true };
    }
  }

  // Invalidate any previous codes for this user.
  await withPrismaRetry(() => prisma.verificationToken.deleteMany({ where: { identifier } }), { retries: 2, delayMs: 150 });

  const code = makeFiveDigitCode();
  const token = hashCode({ userId, code, secret });

  await withPrismaRetry(
    () =>
      prisma.verificationToken.create({
        data: {
          identifier,
          token,
          expires: expiresAt,
        },
      }),
    { retries: 2, delayMs: 150 }
  );

  return { code, expiresAt, suppressedByCooldown: false };
}

export async function consumeEmailLoginCode(params: { userId: string; code: string }): Promise<boolean> {
  const userId = String(params.userId ?? "").trim();
  const code = String(params.code ?? "").trim();
  if (!userId || !code) return false;

  const secret = getCodeSecret();
  const identifier = identifierKeyForUserId(userId);
  const token = hashCode({ userId, code, secret });
  const now = new Date();

  const found = await withPrismaRetry(
    () =>
      prisma.verificationToken.findFirst({
        where: {
          identifier,
          token,
          expires: { gt: now },
        },
        select: { token: true },
      }),
    { retries: 2, delayMs: 150 }
  );
  if (!found) return false;

  // Single-use: delete all active tokens for this user.
  await withPrismaRetry(() => prisma.verificationToken.deleteMany({ where: { identifier } }), { retries: 2, delayMs: 150 });
  return true;
}

export function isEmailLoginCodeRequired(): boolean {
  // Keep it dead-simple: you can flip this on later.
  return String(process.env.AUTH_REQUIRE_EMAIL_CODE ?? "").trim() === "1";
}
