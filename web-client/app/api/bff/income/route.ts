import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { getAllIncome } from "@/lib/income/store";
import { canonicalizeIncomeName } from "@/lib/income/name";
import { monthNumberToKey } from "@/lib/helpers/monthKey";
import { normalizePayFrequency } from "@/lib/payPeriods";
import { getIncomePeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";

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

function isAllCapsName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-Z]+/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function pickCanonicalRow<T extends { id: string; name: string; updatedAt: Date; createdAt: Date }>(rows: T[]): T {
  let best = rows[0];
  for (const row of rows) {
    const bestLegacy = isAllCapsName(best.name);
    const rowLegacy = isAllCapsName(row.name);
    if (bestLegacy !== rowLegacy) {
      best = rowLegacy ? best : row;
      continue;
    }
    if (row.updatedAt.getTime() !== best.updatedAt.getTime()) {
      best = row.updatedAt > best.updatedAt ? row : best;
      continue;
    }
    if (row.createdAt.getTime() !== best.createdAt.getTime()) {
      best = row.createdAt > best.createdAt ? row : best;
    }
  }
  return best;
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
      const monthKey = monthNumberToKey(parsedMonth);
      const prevMonth = parsedMonth === 1 ? 12 : parsedMonth - 1;
      const prevYear = parsedMonth === 1 ? parsedYear - 1 : parsedYear;
      const prevMonthKey = monthNumberToKey(prevMonth as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12);

      const [incomeByMonth, prevIncomeByMonth, profile] = await Promise.all([
        getAllIncome(budgetPlanId, parsedYear),
        prevYear === parsedYear ? Promise.resolve(null) : getAllIncome(budgetPlanId, prevYear),
        prisma.userOnboardingProfile.findUnique({ where: { userId }, select: { payFrequency: true } }).catch(() => null),
      ]);

      const payFrequency = normalizePayFrequency(profile?.payFrequency);
      const endItems = incomeByMonth[monthKey] ?? [];
      const startItems = payFrequency === "monthly"
        ? ((prevYear === parsedYear
          ? (incomeByMonth[prevMonthKey] ?? [])
          : (prevIncomeByMonth?.[prevMonthKey] ?? [])))
        : [];

      const endKeys = new Set(endItems.map((i) => normalizeIncomeKey(i.name)).filter(Boolean));
      const extraStartItems = startItems.filter((i) => {
        const key = normalizeIncomeKey(i.name);
        return Boolean(key) && !endKeys.has(key) && !isCarryOverIncome(i.name);
      });

      const extraIds = new Set(extraStartItems.map((i) => i.id));

      const items = payFrequency === "monthly" ? [...endItems, ...extraStartItems] : endItems;

      return NextResponse.json(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          amount: i.amount,
          month: extraIds.has(i.id) ? prevMonth : parsedMonth,
          year: extraIds.has(i.id) ? prevYear : parsedYear,
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
    const payDate = await resolvePayDate(budgetPlanId);
    for (const y of targetYears) {
      const shouldSpreadMonths = distributeFullYear || distributeMonths;
      const startMonth = y === year ? month : (shouldSpreadMonths ? 1 : month);
      const endMonth = shouldSpreadMonths ? 12 : month;
      for (let m = startMonth; m <= endMonth; m++) {
      // Upsert (case-insensitive) so we don't create duplicates on re-run.
      // If duplicates already exist, update ONE canonical row and delete the rest.
      const existing = await prisma.income.findMany({
        where: {
          budgetPlanId,
          month: m,
          year: y,
          name: { equals: name, mode: "insensitive" },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (existing.length > 0) {
        const canonical = pickCanonicalRow(existing);
        const updated = await prisma.income.update({
          where: { id: canonical.id },
          data: { name, amount, periodKey: getIncomePeriodKey({ year: y, month: m }, payDate) },
        });
        const toDelete = existing.filter((r) => r.id !== canonical.id).map((r) => r.id);
        if (toDelete.length > 0) {
          await prisma.income.deleteMany({ where: { id: { in: toDelete } } });
        }
        if (!firstCreated) firstCreated = updated;
        continue;
      }
      const record = await prisma.income.create({
        data: { name, amount, month: m, year: y, budgetPlanId, periodKey: getIncomePeriodKey({ year: y, month: m }, payDate) },
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
