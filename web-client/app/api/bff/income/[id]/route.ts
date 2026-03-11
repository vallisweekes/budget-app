import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { getIncomePeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";
import { canonicalizeIncomeName } from "@/lib/income/name";
import { normalizePayFrequency } from "@/lib/payPeriods";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function normalizeName(name: unknown): string {
  return canonicalizeIncomeName(name);
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
      // Recompute periodKey if month or year changed
      const nextYear = typeof data.year === "number" ? data.year : existing.year;
      const nextMonth = typeof data.month === "number" ? data.month : existing.month;
      const [payDate, profile] = await Promise.all([
        resolvePayDate(existing.budgetPlanId),
        prisma.userOnboardingProfile.findUnique({ where: { userId }, select: { payFrequency: true } }).catch(() => null),
      ]);
      const payFrequency = normalizePayFrequency(profile?.payFrequency);
      const periodKey = getIncomePeriodKey({ year: nextYear, month: nextMonth }, payDate, payFrequency);

      const updated = await tx.income.update({
        where: { id },
        data: { ...data, periodKey },
      });

      // After updating, collapse any legacy duplicates (case-insensitive name match)
      // in the *resulting* month/year, keeping the row the user edited.
      await tx.income.deleteMany({
        where: {
          budgetPlanId: updated.budgetPlanId,
          name: { equals: nextName, mode: "insensitive" },
          id: { not: updated.id },
          OR: [
            { year: updated.year, month: updated.month },
            { periodKey },
          ],
        },
      });

      // Ensure we return the current row (with any coerced amount)
      const refreshed = await tx.income.findUnique({ where: { id: updated.id } });
      return refreshed ?? updated;
    });

    await invalidateDashboardCache(existing.budgetPlanId);

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
  	await invalidateDashboardCache(existing.budgetPlanId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete income:", error);
    return NextResponse.json(
      { error: "Failed to delete income" },
      { status: 500 }
    );
  }
}
