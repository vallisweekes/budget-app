import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import {
  confirmSacrificeTransfer,
  listSacrificeGoalLinks,
  listSacrificeTransferConfirmations,
  parseTargetKey,
  removeSacrificeGoalLink,
  upsertSacrificeGoalLink,
} from "@/lib/income-sacrifice/goalLinks";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function parseMonthYear(searchParams: URLSearchParams): { month: number; year: number } {
  const monthRaw = Number(searchParams.get("month"));
  const yearRaw = Number(searchParams.get("year"));
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  return { month, year };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const budgetPlanId = await resolveOwnedBudgetPlanId({
      userId,
      budgetPlanId: searchParams.get("budgetPlanId"),
    });
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const { month, year } = parseMonthYear(searchParams);

    const [goals, links, confirmations] = await Promise.all([
      prisma.goal.findMany({
        where: { budgetPlanId },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          category: true,
          targetAmount: true,
          currentAmount: true,
        },
      }),
      listSacrificeGoalLinks(budgetPlanId),
      listSacrificeTransferConfirmations({ budgetPlanId, year, month }),
    ]);

    return NextResponse.json({
      budgetPlanId,
      year,
      month,
      goals,
      links,
      confirmations,
    });
  } catch (error) {
    console.error("[bff/income-sacrifice/goals] GET error", error);
    return NextResponse.json({ error: "Failed to load sacrifice goal links" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const budgetPlanId = await resolveOwnedBudgetPlanId({
      userId,
      budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
    });
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const targetKey = typeof body.targetKey === "string" ? body.targetKey.trim() : "";
    const parsed = parseTargetKey(targetKey);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid target key" }, { status: 400 });
    }

    const goalId = typeof body.goalId === "string" ? body.goalId.trim() : "";
    if (!goalId) {
      await removeSacrificeGoalLink({ budgetPlanId, targetKey });
      return NextResponse.json({ success: true, unlinked: true });
    }

    const goal = await prisma.goal.findFirst({
      where: { id: goalId, budgetPlanId },
      select: { id: true },
    });
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    await upsertSacrificeGoalLink({
      budgetPlanId,
      targetKey,
      goalId,
    });

    return NextResponse.json({ success: true, linked: true });
  } catch (error) {
    console.error("[bff/income-sacrifice/goals] PATCH error", error);
    return NextResponse.json({ error: "Failed to save sacrifice goal link" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const budgetPlanId = await resolveOwnedBudgetPlanId({
      userId,
      budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
    });
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const targetKey = typeof body.targetKey === "string" ? body.targetKey.trim() : "";
    const parsed = parseTargetKey(targetKey);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid target key" }, { status: 400 });
    }

    const monthRaw = Number(body.month);
    const yearRaw = Number(body.year);
    const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
    const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();

    const result = await confirmSacrificeTransfer({
      budgetPlanId,
      year,
      month,
      targetKey,
    });

    return NextResponse.json({
      success: true,
      alreadyConfirmed: !result.created,
      amount: result.amount,
      goalId: result.goalId,
    });
  } catch (error) {
    console.error("[bff/income-sacrifice/goals] POST error", error);
    const message = error instanceof Error ? error.message : "Failed to confirm sacrifice transfer";
    if (
      message === "No linked goal for this sacrifice target." ||
      message.includes("not available yet")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
