import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { sendEmailVerificationEmail } from "@/lib/auth/emailVerification";
import { completeOnboarding, getOnboardingForUser, saveOnboardingDraft, type OnboardingGoalInput, type OnboardingInput } from "@/lib/onboarding";
import { invalidateDashboardCache, invalidateDashboardCacheForUser } from "@/lib/cache/dashboardCache";
import { invalidateProfileCache } from "@/lib/cache/profileCache";
import { bestEffortWithin } from "@/lib/bestEffortWithin";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return null;
}

const ONBOARDING_GOALS: readonly OnboardingGoalInput[] = [
  "improve_savings",
  "emergency_fund",
  "investments",
  "manage_debts",
  "track_spending",
  "build_budget",
];

function isOnboardingGoal(value: unknown): value is OnboardingGoalInput {
  return typeof value === "string" && ONBOARDING_GOALS.includes(value as OnboardingGoalInput);
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const data = await getOnboardingForUser(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch onboarding:", error);
    return NextResponse.json({ error: "Failed to fetch onboarding" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const mainGoal = isOnboardingGoal(body.mainGoal) ? body.mainGoal : null;

    const mainGoals = Array.isArray(body.mainGoals)
      ? body.mainGoals.filter(isOnboardingGoal)
      : null;

    const input: OnboardingInput = {
      mainGoal,
      mainGoals,
      occupation: typeof body.occupation === "string" ? body.occupation : null,
      occupationOther: typeof body.occupationOther === "string" ? body.occupationOther : null,
      payDay: asNumber(body.payDay),
      payAnchorDate: typeof body.payAnchorDate === "string" ? body.payAnchorDate : null,
      payFrequency:
        body.payFrequency === "monthly" || body.payFrequency === "every_2_weeks" || body.payFrequency === "every_4_weeks" || body.payFrequency === "weekly"
          ? body.payFrequency
          : null,
      billFrequency: body.billFrequency === "monthly" || body.billFrequency === "every_2_weeks" ? body.billFrequency : null,
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

    const updated = await saveOnboardingDraft(userId, input);
    void bestEffortWithin(
      Promise.all([
        invalidateDashboardCacheForUser(userId),
        invalidateProfileCache(userId),
      ]).catch(() => undefined),
      250,
    );
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    console.error("Failed to update onboarding:", error);
    const message = error instanceof Error ? error.message : "Failed to update onboarding";
    const status = message === "Onboarding profile not found" ? 404 : 500;

    // Don’t expose internal Prisma/stack details to the client.
    const clientMessage = status === 404 ? message : "Could not save right now. Please try again.";
    return NextResponse.json({ error: clientMessage }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const result = await completeOnboarding(userId);
    void bestEffortWithin(
      sendEmailVerificationEmail(userId, { resetDeadline: true }).catch((verificationError) => {
        console.error("Failed to send onboarding verification email:", verificationError);
      }),
      900,
    );
    void bestEffortWithin(
      Promise.all([
        invalidateDashboardCache(result.budgetPlanId),
        invalidateProfileCache(userId),
      ]).catch(() => undefined),
      250,
    );
    return NextResponse.json({ ok: true, budgetPlanId: result.budgetPlanId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete onboarding";
    const status = message === "Onboarding profile not found" ? 404 : 500;
    console.error("Failed to complete onboarding:", error);
    const clientMessage = status === 404 ? message : "Could not complete onboarding right now. Please try again.";
    return NextResponse.json({ error: clientMessage }, { status });
  }
}
