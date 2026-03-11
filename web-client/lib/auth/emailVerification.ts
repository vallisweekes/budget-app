import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { resend, FROM_ADDRESS } from "@/lib/email/client";

const IDENTIFIER_PREFIX = "email_verification:";
const DEADLINE_TOKEN = "__deadline__";
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROLLOUT_AT = "2026-03-11T00:00:00.000Z";

export type EmailVerificationStatus = "verified" | "pending" | "missing_email" | "not_required";

export type EmailVerificationState = {
  status: EmailVerificationStatus;
  emailVerifiedAt: Date | null;
  deadlineAt: Date | null;
  required: boolean;
  blocked: boolean;
};

type VerificationUserContext = {
  id: string;
  email: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  onboardingProfile: {
    status: "started" | "completed";
    completedAt: Date | null;
  } | null;
  budgetPlans: Array<{ id: string }>;
};

function identifierForUser(userId: string): string {
  return `${IDENTIFIER_PREFIX}${userId}`;
}

function getRolloutAt(): Date {
  const raw = String(process.env.EMAIL_VERIFICATION_ROLLOUT_AT ?? DEFAULT_ROLLOUT_AT).trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(DEFAULT_ROLLOUT_AT);
  }
  return parsed;
}

function getAppUrl(): string {
  return String(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "https://budgetincheck.com")
    .trim()
    .replace(/\/$/, "");
}

function buildVerificationUrl(token: string): string {
  return `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildVerificationEmail(params: { verifyUrl: string; deadlineAt: Date }): { subject: string; html: string; text: string } {
  const deadlineLabel = params.deadlineAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  return {
    subject: "Verify your BudgetIn Check email",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#101828;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:24px;margin-bottom:12px;">Verify your email</h1>
        <p style="margin:0 0 12px;">Finish verifying your BudgetIn Check account to keep using the mobile app without interruption.</p>
        <p style="margin:0 0 20px;">Your verification window ends on <strong>${deadlineLabel}</strong>.</p>
        <a href="${params.verifyUrl}" style="display:inline-block;background:#7c5cff;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Verify email</a>
        <p style="margin:20px 0 8px;">If the button does not work, open this link:</p>
        <p style="word-break:break-all;margin:0;color:#475467;">${params.verifyUrl}</p>
      </div>
    `,
    text: [
      "Verify your BudgetIn Check email.",
      "",
      `Your verification window ends on ${deadlineLabel}.`,
      "",
      params.verifyUrl,
    ].join("\n"),
  };
}

async function loadUserContext(userId: string): Promise<VerificationUserContext | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      onboardingProfile: {
        select: {
          status: true,
          completedAt: true,
        },
      },
      budgetPlans: {
        select: { id: true },
        take: 1,
      },
    },
  });
}

function isEstablishedUser(user: VerificationUserContext): boolean {
  return user.budgetPlans.length > 0 || user.onboardingProfile?.status === "completed";
}

async function getDeadlineRecord(userId: string) {
  return prisma.verificationToken.findFirst({
    where: {
      identifier: identifierForUser(userId),
      token: DEADLINE_TOKEN,
    },
    select: {
      expires: true,
    },
  });
}

async function upsertDeadlineRecord(userId: string, expiresAt: Date) {
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: identifierForUser(userId),
      token: DEADLINE_TOKEN,
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: identifierForUser(userId),
      token: DEADLINE_TOKEN,
      expires: expiresAt,
    },
  });
}

async function clearLinkTokens(userId: string) {
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: identifierForUser(userId),
      NOT: { token: DEADLINE_TOKEN },
    },
  });
}

export async function maybeBackfillLegacyVerifiedUser(userId: string): Promise<void> {
  const user = await loadUserContext(userId);
  if (!user || user.emailVerified || !user.email) return;
  if (!isEstablishedUser(user)) return;
  if (user.createdAt.getTime() >= getRolloutAt().getTime()) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: user.onboardingProfile?.completedAt ?? user.createdAt,
    },
  });

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: identifierForUser(userId),
    },
  });
}

async function ensureDeadline(userId: string, options?: { reset?: boolean }): Promise<Date | null> {
  const user = await loadUserContext(userId);
  if (!user || user.emailVerified || !user.email || !isEstablishedUser(user)) return null;

  const existing = await getDeadlineRecord(userId);
  if (!options?.reset && existing?.expires instanceof Date) {
    return existing.expires;
  }

  const deadlineAt = new Date(Date.now() + GRACE_PERIOD_MS);
  await upsertDeadlineRecord(userId, deadlineAt);
  return deadlineAt;
}

export async function getEmailVerificationState(userId: string): Promise<EmailVerificationState> {
  await maybeBackfillLegacyVerifiedUser(userId);
  const user = await loadUserContext(userId);

  if (!user) {
    return {
      status: "not_required",
      emailVerifiedAt: null,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  if (user.emailVerified) {
    return {
      status: "verified",
      emailVerifiedAt: user.emailVerified,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  if (!user.email) {
    return {
      status: "missing_email",
      emailVerifiedAt: null,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  if (!isEstablishedUser(user)) {
    return {
      status: "not_required",
      emailVerifiedAt: null,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  const deadlineAt = await ensureDeadline(userId);
  const blocked = deadlineAt instanceof Date ? deadlineAt.getTime() <= Date.now() : false;

  return {
    status: "pending",
    emailVerifiedAt: null,
    deadlineAt,
    required: true,
    blocked,
  };
}

export async function sendEmailVerificationEmail(userId: string, options?: { resetDeadline?: boolean }): Promise<EmailVerificationState> {
  await maybeBackfillLegacyVerifiedUser(userId);
  const user = await loadUserContext(userId);
  if (!user) {
    return {
      status: "not_required",
      emailVerifiedAt: null,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  if (user.emailVerified) {
    return {
      status: "verified",
      emailVerifiedAt: user.emailVerified,
      deadlineAt: null,
      required: false,
      blocked: false,
    };
  }

  if (!user.email || !isEstablishedUser(user)) {
    return getEmailVerificationState(userId);
  }

  const deadlineAt = await ensureDeadline(userId, { reset: options?.resetDeadline === true });
  if (!(deadlineAt instanceof Date)) {
    return getEmailVerificationState(userId);
  }

  await clearLinkTokens(userId);
  const token = crypto.randomBytes(24).toString("hex");
  const linkExpiresAt = new Date(Date.now() + LINK_TTL_MS);

  await prisma.verificationToken.create({
    data: {
      identifier: identifierForUser(userId),
      token,
      expires: linkExpiresAt,
    },
  });

  const verifyUrl = buildVerificationUrl(token);
  const email = buildVerificationEmail({ verifyUrl, deadlineAt });

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return {
    status: "pending",
    emailVerifiedAt: null,
    deadlineAt,
    required: true,
    blocked: deadlineAt.getTime() <= Date.now(),
  };
}

export async function consumeEmailVerificationToken(rawToken: string): Promise<"verified" | "expired" | "invalid"> {
  const token = String(rawToken ?? "").trim();
  if (!token || token === DEADLINE_TOKEN) return "invalid";

  const record = await prisma.verificationToken.findUnique({
    where: { token },
    select: {
      identifier: true,
      expires: true,
    },
  });

  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) {
    return "invalid";
  }

  const userId = record.identifier.slice(IDENTIFIER_PREFIX.length);
  if (!userId) return "invalid";

  if (record.expires.getTime() <= Date.now()) {
    return "expired";
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date(),
      },
    }),
    prisma.verificationToken.deleteMany({
      where: {
        identifier: record.identifier,
      },
    }),
  ]);

  return "verified";
}