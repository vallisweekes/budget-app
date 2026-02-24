import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function toBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (!v) return false;
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  }
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const existing = await prisma.budgetPlan.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Plan name cannot be empty" }, { status: 400 });
      data.name = name;
    }

    if (typeof body.budgetHorizonYears !== "undefined") {
      const years = Number(body.budgetHorizonYears);
      if (!Number.isInteger(years) || years < 1 || years > 50) {
        return NextResponse.json({ error: "budgetHorizonYears must be an integer between 1 and 50" }, { status: 400 });
      }
      data.budgetHorizonYears = years;
    }

    if (typeof body.payDate !== "undefined") {
      const payDate = Number(body.payDate);
      if (!Number.isInteger(payDate) || payDate < 1 || payDate > 31) {
        return NextResponse.json({ error: "payDate must be between 1 and 31" }, { status: 400 });
      }
      data.payDate = payDate;
    }

    if (typeof body.includePostEventIncome !== "undefined") {
      data.includePostEventIncome = toBool(body.includePostEventIncome);
    }

    if (typeof body.eventDate === "string") {
      const parsed = new Date(body.eventDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid eventDate" }, { status: 400 });
      }
      data.eventDate = parsed;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.budgetPlan.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        kind: true,
        payDate: true,
        budgetHorizonYears: true,
        includePostEventIncome: true,
        eventDate: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update budget plan:", error);
    return NextResponse.json({ error: "Failed to update budget plan" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const existing = await prisma.budgetPlan.findUnique({
      where: { id },
      select: { id: true, userId: true, kind: true },
    });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
    }

    if (existing.kind === "personal") {
      return NextResponse.json({ error: "You can only delete sub plans from here" }, { status: 400 });
    }

    await prisma.budgetPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete budget plan:", error);
    return NextResponse.json({ error: "Failed to delete budget plan" }, { status: 500 });
  }
}
