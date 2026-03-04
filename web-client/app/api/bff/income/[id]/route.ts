import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function normalizeName(name: unknown): string {
	return String(name ?? "").trim().replace(/\s+/g, " ");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const income = await prisma.income.findUnique({
      where: { id },
			include: { budgetPlan: { select: { userId: true } } },
    });

    if (!income || income.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

		const { budgetPlan, ...safe } = income;
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
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

    const existing = await prisma.income.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!existing || existing.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof raw.name === "string") data.name = normalizeName(raw.name);
    if (typeof raw.amount !== "undefined") {
      const nextAmount = Number(raw.amount);
      if (!Number.isFinite(nextAmount)) {
        return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
      }
      data.amount = nextAmount;
    }
    if (typeof raw.month === "number") data.month = raw.month;
    if (typeof raw.year === "number") data.year = raw.year;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const nextName = typeof data.name === "string" && data.name.trim() ? (data.name as string) : existing.name;

    const merged = await prisma.$transaction(async (tx) => {
      const updated = await tx.income.update({
        where: { id },
        data,
      });

      // After updating, collapse any legacy duplicates (case-insensitive name match)
      // in the *resulting* month/year, keeping the row the user edited.
      await tx.income.deleteMany({
        where: {
          budgetPlanId: updated.budgetPlanId,
          year: updated.year,
          month: updated.month,
          name: { equals: nextName, mode: "insensitive" },
          id: { not: updated.id },
        },
      });

      // Ensure we return the current row (with any coerced amount)
      const refreshed = await tx.income.findUnique({ where: { id: updated.id } });
      return refreshed ?? updated;
    });

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Failed to update income:", error);
    return NextResponse.json(
      { error: "Failed to update income" },
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
		const existing = await prisma.income.findUnique({
			where: { id },
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!existing || existing.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Income not found" }, { status: 404 });
		}

    // Delete only the requested row.
    await prisma.income.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete income:", error);
    return NextResponse.json(
      { error: "Failed to delete income" },
      { status: 500 }
    );
  }
}
