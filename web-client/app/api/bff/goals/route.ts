import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const goals = await prisma.goal.findMany({
      where: { budgetPlanId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const body = await request.json();
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: typeof body?.budgetPlanId === "string" ? body.budgetPlanId : null,
		});
    if (!budgetPlanId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const inferCategory = (t: string): "debt" | "emergency" | "savings" | "investment" | "other" => {
      const s = t.toLowerCase();
      if (s.includes("emergency")) return "emergency";
      if (s.includes("saving")) return "savings";
      if (s.includes("debt")) return "debt";
      if (s.includes("invest")) return "investment";
      return "other";
    };

    const toDbType = (v: unknown): "yearly" | "long_term" | "short_term" => {
      const s = typeof v === "string" ? v.trim() : "";
      if (s === "yearly") return "yearly";
      if (s === "short_term" || s === "short-term" || s === "short") return "short_term";
      if (s === "long_term" || s === "long-term" || s === "long") return "long_term";
      return "long_term";
    };

    const toDbCategory = (v: unknown, fallbackTitle: string): "debt" | "emergency" | "savings" | "investment" | "other" => {
      const s = typeof v === "string" ? v.trim() : "";
      if (s === "debt" || s === "emergency" || s === "savings" || s === "investment" || s === "other") return s;
      return inferCategory(fallbackTitle);
    };

    const cleanAmount = (v: unknown): number | null | undefined => {
      if (v === null) return null;
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) return undefined;
      return Math.round(n * 100) / 100;
    };

    const type = toDbType(body?.type);
    const category = toDbCategory(body?.category, title);
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

    const targetAmount = cleanAmount(body?.targetAmount);
    const currentAmount = cleanAmount(body?.currentAmount);
    const targetYear = typeof body?.targetYear === "number" && Number.isFinite(body.targetYear) ? body.targetYear : null;

    const goal = await prisma.goal.create({
      data: {
        title,
        type,
        category,
        description,
        targetAmount: targetAmount === undefined ? null : targetAmount,
        currentAmount: currentAmount === undefined ? 0 : currentAmount,
        targetYear,
        budgetPlanId,
      },
    });

    return NextResponse.json({ goalId: goal.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create goal:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to create goal",
        ...(process.env.NODE_ENV !== "production" ? { detail } : null),
      },
      { status: 500 },
    );
  }
}
