import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { assertRegistrationAvailability, getUserByUsername, registerUserByUsername } from "@/lib/budgetPlans";
import { normalizeUsername } from "@/lib/helpers/username";
import { createMobileAuthSession } from "@/lib/mobileAuthSessions";
import { consumeEmailLoginCode, isEmailLoginCodeRequired } from "@/lib/auth/loginCodes";
import { isRetryableConnectionError } from "@/lib/prismaRetry";
import { buildProfileResponse } from "@/lib/profileResponse";
import { completeOnboarding, saveOnboardingDraft, type OnboardingGoalInput, type OnboardingInput } from "@/lib/onboarding";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";
import { invalidateProfileCache } from "@/lib/cache/profileCache";
import { sendEmailVerificationEmail } from "@/lib/auth/emailVerification";
import { deriveBillFrequencyFromPayFrequency } from "@/lib/payPeriods";

export const runtime = "nodejs";

type AuthMode = "login" | "register" | "register_check" | "register_complete";

const ONBOARDING_GOALS: readonly OnboardingGoalInput[] = [
  "improve_savings",
  "emergency_fund",
  "investments",
  "manage_debts",
  "track_spending",
  "build_budget",
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return null;
}

function isOnboardingGoal(value: unknown): value is OnboardingGoalInput {
  return typeof value === "string" && ONBOARDING_GOALS.includes(value as OnboardingGoalInput);
}

function getAuthMode(value: unknown): AuthMode {
  const normalized = String(value ?? "login").trim().toLowerCase();
  if (normalized === "register") return "register";
  if (normalized === "register_check") return "register_check";
  if (normalized === "register_complete") return "register_complete";
  return "login";
}

function parseOnboardingInput(value: unknown): OnboardingInput | null {
  if (!value || typeof value !== "object") return null;

  const body = value as Record<string, unknown>;
  const mainGoals = Array.isArray(body.mainGoals) ? body.mainGoals.filter(isOnboardingGoal) : null;
  const payFrequency =
    body.payFrequency === "monthly" || body.payFrequency === "every_2_weeks" || body.payFrequency === "every_4_weeks" || body.payFrequency === "weekly"
      ? body.payFrequency
      : null;

  return {
    mainGoal: isOnboardingGoal(body.mainGoal) ? body.mainGoal : null,
    mainGoals,
    occupation: typeof body.occupation === "string" ? body.occupation : null,
    occupationOther: typeof body.occupationOther === "string" ? body.occupationOther : null,
    payDay: asNumber(body.payDay),
    payAnchorDate: typeof body.payAnchorDate === "string" ? body.payAnchorDate : null,
    payFrequency,
    billFrequency: payFrequency ? deriveBillFrequencyFromPayFrequency(payFrequency) : null,
    monthlySalary: asNumber(body.monthlySalary),
    planningYears: asNumber(body.planningYears),
    savingsGoalAmount: asNumber(body.savingsGoalAmount),
    savingsGoalYear: asNumber(body.savingsGoalYear),
    expenseOneName: typeof body.expenseOneName === "string" ? body.expenseOneName : null,
    expenseOneAmount: asNumber(body.expenseOneAmount),
    expenseTwoName: typeof body.expenseTwoName === "string" ? body.expenseTwoName : null,
    expenseTwoAmount: asNumber(body.expenseTwoAmount),
    expenseThreeName: typeof body.expenseThreeName === "string" ? body.expenseThreeName : null,
    expenseThreeAmount: asNumber(body.expenseThreeAmount),
    expenseFourName: typeof body.expenseFourName === "string" ? body.expenseFourName : null,
    expenseFourAmount: asNumber(body.expenseFourAmount),
    hasAllowance: asBoolean(body.hasAllowance),
    allowanceAmount: asNumber(body.allowanceAmount),
    hasDebtsToManage: asBoolean(body.hasDebtsToManage),
    debtAmount: asNumber(body.debtAmount),
    debtNotes: typeof body.debtNotes === "string" ? body.debtNotes : null,
  };
}

async function createMobileSessionPayload(userId: string, username: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Server auth is not configured");
  }

  const maxAge = 30 * 24 * 60 * 60;
  const { sessionId } = await createMobileAuthSession({
    userId,
    maxAgeSeconds: maxAge,
  });

  const token = await encode({
    token: {
      sub: userId,
      name: username,
      userId,
      username,
      sid: sessionId,
    },
    secret,
    maxAge,
  });

  return {
    token,
    username,
    userId,
    sessionId,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return badRequest("Invalid request body");

    const rawUsername = String(body.username ?? "");
    const username = normalizeUsername(rawUsername);
    if (!username) return badRequest("Username is required");

    const mode = getAuthMode(body.mode);

    const email = String(body.email ?? "").trim().toLowerCase();

    if (mode === "register_check") {
      await assertRegistrationAvailability({ username, email });
      return NextResponse.json({ ok: true, username, email });
    }

    if (mode === "register_complete") {
      const onboarding = parseOnboardingInput(body.onboarding);
      if (!onboarding) {
        return badRequest("Onboarding data is required");
      }

      const user = await registerUserByUsername({ username, email });
      const canonicalUsername = normalizeUsername(String(user.name ?? "")) || username;

      await saveOnboardingDraft(user.id, onboarding);
      const result = await completeOnboarding(user.id);

      try {
        await sendEmailVerificationEmail(user.id, { resetDeadline: true });
      } catch (verificationError) {
        console.error("Failed to send onboarding verification email:", verificationError);
      }

      await invalidateDashboardCache(result.budgetPlanId);
      await invalidateProfileCache(user.id);

      const profile = await buildProfileResponse(user.id);
      if (!profile) {
        return NextResponse.json({ error: "User cannot be found" }, { status: 404 });
      }

      const session = await createMobileSessionPayload(user.id, canonicalUsername);

      return NextResponse.json({
        ...session,
        budgetPlanId: result.budgetPlanId,
        profile,
      });
    }

    const user =
      mode === "register"
        ? await registerUserByUsername({ username, email })
        : await getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: "User cannot be found" }, { status: 401 });
    }

    if (mode === "login" && isEmailLoginCodeRequired()) {
      const code = String(body.code ?? "").trim();
      if (!code) return NextResponse.json({ error: "Login code is required" }, { status: 400 });
      const ok = await consumeEmailLoginCode({ userId: user.id, code });
      if (!ok) return NextResponse.json({ error: "Invalid login code" }, { status: 400 });
    }

    const canonicalUsername = normalizeUsername(String(user.name ?? "")) || username;
    return NextResponse.json(await createMobileSessionPayload(user.id, canonicalUsername));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    const normalizedMessage = message.toLowerCase();

    if (isRetryableConnectionError(error)) {
      return NextResponse.json({ error: "Database is temporarily busy. Please try again." }, { status: 503 });
    }

    if (
      message === "Email already in use"
      || message === "User already exists"
      || message === "Email is required"
      || message === "Invalid email address"
      || message === "Username is required"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Gracefully map common Prisma uniqueness failures into UX-friendly messages.
    if (normalizedMessage.includes("p2002") || normalizedMessage.includes("unique constraint")) {
      if (normalizedMessage.includes("email")) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
      if (normalizedMessage.includes("name") || normalizedMessage.includes("username")) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    if (
      message.includes("onboardingProfile")
      || message.includes("UserOnboardingProfile")
      || message.includes("P2021")
      || message.includes("does not exist")
    ) {
      return NextResponse.json({ error: "Onboarding migration is missing. Run prisma migrate deploy." }, { status: 500 });
    }

    if (normalizedMessage.includes("jwe") || normalizedMessage.includes("nextauth_secret")) {
      return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
    }

    console.error("Mobile auth failed:", error);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ error: message || "Authentication failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
