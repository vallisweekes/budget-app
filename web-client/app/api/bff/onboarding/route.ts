import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { completeOnboarding, getOnboardingForUser, saveOnboardingDraft, type OnboardingInput } from "@/lib/onboarding";

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

export async function GET() {
  try {
    const userId = await getSessionUserId();
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
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const input: OnboardingInput = {
      mainGoal:
        body.mainGoal === "improve_savings" || body.mainGoal === "manage_debts" || body.mainGoal === "track_spending"
          ? body.mainGoal
          : null,
      occupation: typeof body.occupation === "string" ? body.occupation : null,
      occupationOther: typeof body.occupationOther === "string" ? body.occupationOther : null,
      monthlySalary: asNumber(body.monthlySalary),
      expenseOneName: typeof body.expenseOneName === "string" ? body.expenseOneName : null,
      expenseOneAmount: asNumber(body.expenseOneAmount),
      expenseTwoName: typeof body.expenseTwoName === "string" ? body.expenseTwoName : null,
      expenseTwoAmount: asNumber(body.expenseTwoAmount),
      hasAllowance: asBoolean(body.hasAllowance),
      allowanceAmount: asNumber(body.allowanceAmount),
      hasDebtsToManage: asBoolean(body.hasDebtsToManage),
      debtAmount: asNumber(body.debtAmount),
      debtNotes: typeof body.debtNotes === "string" ? body.debtNotes : null,
    };

    const updated = await saveOnboardingDraft(userId, input);
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding";
    const status = message === "Onboarding profile not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const result = await completeOnboarding(userId);
    return NextResponse.json({ ok: true, budgetPlanId: result.budgetPlanId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete onboarding";
    const status = message === "Onboarding profile not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
