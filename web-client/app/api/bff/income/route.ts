import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getAllIncome, getIncomeForAnchorMonth, upsertIncomeForAnchorMonth } from "@/lib/income/store";
import { canonicalizeIncomeName } from "@/lib/income/name";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { invalidateDashboardCache } from "@/lib/cache/dashboardCache";

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

function normalizeName(name: unknown): string {
  return canonicalizeIncomeName(name);
}

function normalizeIncomeKey(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isCarryOverIncome(name: unknown): boolean {
  const normalized = normalizeIncomeKey(name);
  return normalized === "carry over" || normalized === "carryover";
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
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

    const parsedMonth = month ? Number(month) : null;
    const parsedYear = year ? Number(year) : null;

    // When a specific month/year is requested, return the canonical (deduped) list.
    if (
      parsedMonth &&
      parsedYear &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12 &&
      Number.isInteger(parsedYear)
    ) {
      const [items, profile] = await Promise.all([
        getIncomeForAnchorMonth({ budgetPlanId, year: parsedYear, month: parsedMonth }),
        prisma.userOnboardingProfile.findUnique({ where: { userId }, select: { payFrequency: true } }).catch(() => null),
      ]);

      return NextResponse.json(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          amount: i.amount,
          month: parsedMonth,
          year: parsedYear,
          budgetPlanId,
        }))
      );
    }

    const where: any = { budgetPlanId };
    if (parsedMonth) where.month = parseInt(String(parsedMonth));
    if (parsedYear) where.year = parseInt(String(parsedYear));

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

    const name: string = normalizeName(body.name);
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
      const record = await upsertIncomeForAnchorMonth({ budgetPlanId, year: y, month: m, name, amount });
      if (!firstCreated) firstCreated = record;
      }
    }

	await invalidateDashboardCache(budgetPlanId);

    return NextResponse.json(firstCreated, { status: 201 });
  } catch (error) {
    console.error("Failed to create income:", error);
    return NextResponse.json(
      { error: "Failed to create income" },
      { status: 500 }
    );
  }
}
