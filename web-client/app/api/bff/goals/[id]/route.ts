import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const goal = await prisma.goal.findUnique({
      where: { id },
			include: { budgetPlan: { select: { userId: true } } },
    });

    if (!goal || goal.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

		const { budgetPlan, ...safe } = goal;
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Failed to fetch goal:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const existing = await prisma.goal.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!existing || existing.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.title === "string") data.title = raw.title;
    if (typeof raw.type === "string") data.type = raw.type;
    if (typeof raw.category === "string") data.category = raw.category;
    if (typeof raw.description === "string" || raw.description === null) data.description = raw.description;
    if (typeof raw.targetAmount !== "undefined") data.targetAmount = raw.targetAmount;
    if (typeof raw.currentAmount !== "undefined") data.currentAmount = raw.currentAmount;
    if (typeof raw.targetYear === "number" || raw.targetYear === null) data.targetYear = raw.targetYear;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const goal = await prisma.goal.update({
      where: { id },
      data,
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Failed to update goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
		const existing = await prisma.goal.findUnique({
			where: { id },
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!existing || existing.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Goal not found" }, { status: 404 });
		}

    await prisma.goal.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
