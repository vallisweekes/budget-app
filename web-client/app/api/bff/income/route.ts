import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";

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

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});

		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const where: any = { budgetPlanId };
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const income = await prisma.income.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    const body = await request.json();
    const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: typeof body?.budgetPlanId === "string" ? body.budgetPlanId : null,
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const name: string = String(body.name ?? "").trim();
    const amount = Number(body.amount);
    const month = Number(body.month);
    const year = Number(body.year);
    const distributeMonths = toBool(body.distributeMonths);
    const distributeYears = toBool(body.distributeYears);
    const distributeFullYear = typeof body.distributeFullYear === "undefined" ? distributeMonths : toBool(body.distributeFullYear);
    const distributeHorizon = toBool(body.distributeHorizon);

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "month must be an integer between 1 and 12" }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 1900) {
      return NextResponse.json({ error: "year must be a valid integer" }, { status: 400 });
    }

    const plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
      select: {
        budgetHorizonYears: true,
      } as any,
    });

    const horizonYearsRaw = Number((plan as any)?.budgetHorizonYears ?? 10);
    const horizonYears = Number.isFinite(horizonYearsRaw) && horizonYearsRaw > 0 ? Math.floor(horizonYearsRaw) : 10;
    const targetYears = distributeHorizon
      ? Array.from({ length: horizonYears }, (_, index) => year + index)
      : (distributeYears ? [year, year + 1] : [year]);

    if (
      typeof body.distributeFullYear !== "undefined" ||
      typeof body.distributeHorizon !== "undefined"
    ) {
      try {
        await prisma.budgetPlan.update({
          where: { id: budgetPlanId },
          data: {
            incomeDistributeFullYearDefault: distributeFullYear,
            incomeDistributeHorizonDefault: distributeHorizon,
          } as any,
        });
      } catch {
        try {
          await prisma.$executeRaw`
            UPDATE "BudgetPlan"
            SET
              "incomeDistributeFullYearDefault" = ${distributeFullYear},
              "incomeDistributeHorizonDefault" = ${distributeHorizon}
            WHERE id = ${budgetPlanId}
          `;
        } catch {
          // Ignore if columns are unavailable on older DBs.
        }
      }
    }

    let firstCreated: any = null;
    for (const y of targetYears) {
      const shouldSpreadMonths = distributeFullYear || distributeMonths;
      const startMonth = y === year ? month : (shouldSpreadMonths ? 1 : month);
      const endMonth = shouldSpreadMonths ? 12 : month;
      for (let m = startMonth; m <= endMonth; m++) {
        // Upsert so we don't create duplicates on re-run
        const existing = await prisma.income.findFirst({
          where: { budgetPlanId, month: m, year: y, name },
        });
        if (existing) {
          if (!firstCreated) firstCreated = existing;
          continue;
        }
        const record = await prisma.income.create({
          data: { name, amount, month: m, year: y, budgetPlanId },
        });
        if (!firstCreated) firstCreated = record;
      }
    }

    return NextResponse.json(firstCreated, { status: 201 });
  } catch (error) {
    console.error("Failed to create income:", error);
    return NextResponse.json(
      { error: "Failed to create income" },
      { status: 500 }
    );
  }
}
