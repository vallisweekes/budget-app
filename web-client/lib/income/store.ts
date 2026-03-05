import { MONTHS } from "@/lib/constants/time";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber, monthNumberToKey } from "@/lib/helpers/monthKey";
import { getIncomePeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";
import type { MonthKey } from "@/types";

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
}

export type IncomeByMonth = Record<MonthKey, IncomeItem[]>;

function emptyIncomeByMonth(): IncomeByMonth {
	return MONTHS.reduce((acc, m) => {
		acc[m] = [];
		return acc;
	}, {} as IncomeByMonth);
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	return Number((value as any).toString?.() ?? value);
}

function prismaBudgetPlanHasField(fieldName: string): boolean {
  try {
    const fields = (prisma as any)?._runtimeDataModel?.models?.BudgetPlan?.fields;
    if (!Array.isArray(fields)) return false;
    return fields.some((f: any) => f?.name === fieldName);
  } catch {
    return false;
  }
}

function normalizeIncomeName(name: unknown): string {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isAllCapsName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return false;
  // Only consider letters when deciding casing.
  const letters = trimmed.replace(/[^a-zA-Z]+/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function pickCanonicalIncomeRow<T extends { name: string; amount: unknown; updatedAt: Date; createdAt: Date }>(
  rows: T[],
  desiredAmountKey?: string,
): T | null {
  if (!rows || rows.length === 0) return null;
  let best: T | null = null;
  for (const row of rows) {
    if (!best) {
      best = row;
      continue;
    }
    const bestLegacy = isAllCapsName(best.name);
    const rowLegacy = isAllCapsName(row.name);
    if (bestLegacy !== rowLegacy) {
      // Prefer non-legacy casing (e.g. Salary over SALARY).
      best = rowLegacy ? best : row;
      continue;
    }

    if (desiredAmountKey) {
      const bestAmtKey: string = decimalToNumber(best.amount).toFixed(2);
      const rowAmtKey: string = decimalToNumber(row.amount).toFixed(2);
      const bestMatches: boolean = bestAmtKey === desiredAmountKey;
      const rowMatches: boolean = rowAmtKey === desiredAmountKey;
      if (bestMatches !== rowMatches) {
        best = rowMatches ? row : best;
        continue;
      }
    }

    // Prefer the most recently updated row.
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

type EventIncomeScope = {
  kind: string;
  eventYear: number;
  eventMonth: number; // 1-12
};

async function getEventIncomeScope(budgetPlanId: string): Promise<EventIncomeScope | null> {
  // Only apply to Holiday/Carnival plans with an event date.
  if (!prismaBudgetPlanHasField("eventDate")) return null;

  const plan = await prisma.budgetPlan.findUnique({
    where: { id: budgetPlanId },
    select: { kind: true, eventDate: true } as any,
  });
  const kind = String((plan as any)?.kind ?? "");
  const eventDate = (plan as any)?.eventDate as Date | null | undefined;
  if (!eventDate) return null;
  if (kind !== "holiday" && kind !== "carnival") return null;

  const eventYear = eventDate.getFullYear();
  const eventMonth = eventDate.getMonth() + 1;
  if (!Number.isFinite(eventYear) || !Number.isFinite(eventMonth)) return null;
  if (eventMonth < 1 || eventMonth > 12) return null;

  return { kind, eventYear, eventMonth };
}

function isAfterEventMonth(params: {
  incomeYear: number;
  incomeMonth: number; // 1-12
  scope: EventIncomeScope;
}): boolean {
  const { incomeYear, incomeMonth, scope } = params;
  if (incomeYear > scope.eventYear) return true;
  if (incomeYear < scope.eventYear) return false;
  return incomeMonth > scope.eventMonth;
}

export async function resolveIncomeYear(budgetPlanId: string): Promise<number> {
  const scope = await getEventIncomeScope(budgetPlanId);
  if (scope) return scope.eventYear;

	const latest = await prisma.income.findFirst({
		where: { budgetPlanId },
		orderBy: [{ year: "desc" }, { month: "desc" }],
		select: { year: true },
	});
	return latest?.year ?? new Date().getFullYear();
}

export async function getAllIncome(budgetPlanId: string, year?: number): Promise<IncomeByMonth> {
  const empty = emptyIncomeByMonth();
  const scope = await getEventIncomeScope(budgetPlanId);
  const resolvedYear = year ?? (await resolveIncomeYear(budgetPlanId));

	if (scope && resolvedYear > scope.eventYear) {
		// All months are after the event year.
		return empty;
	}

  const rows = await prisma.income.findMany({
    where: { budgetPlanId, year: resolvedYear },
    orderBy: [{ month: "asc" }, { updatedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, amount: true, month: true, createdAt: true, updatedAt: true },
  });

  const candidatesByMonth = new Map<MonthKey, Map<string, Array<(typeof rows)[number]>>>(
    MONTHS.map((m) => [m, new Map()])
  );
  const amountCountsByKey = new Map<string, Map<string, number>>();

  for (const row of rows) {
		if (scope && resolvedYear === scope.eventYear && row.month > scope.eventMonth) {
			// Ignore income after the event month.
			continue;
		}
    const monthKey = monthNumberToKey(row.month);
    const key = normalizeIncomeName(row.name);
    if (!key) continue;
    const monthMap = candidatesByMonth.get(monthKey);
    if (!monthMap) continue;
    const list = monthMap.get(key) ?? [];
    list.push(row);
    monthMap.set(key, list);

    const amount = decimalToNumber(row.amount);
    const amountKey = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
    const counts = amountCountsByKey.get(key) ?? new Map<string, number>();
    counts.set(amountKey, (counts.get(amountKey) ?? 0) + 1);
    amountCountsByKey.set(key, counts);
  }

  const modeAmountByKey = new Map<string, string>();
  for (const [key, counts] of amountCountsByKey.entries()) {
    let bestAmt = "0.00";
    let bestCount = -1;
    for (const [amt, count] of counts.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestAmt = amt;
      }
    }
    modeAmountByKey.set(key, bestAmt);
  }

  for (const monthKey of MONTHS) {
    const monthMap = candidatesByMonth.get(monthKey);
    if (!monthMap) continue;
    const chosen: IncomeItem[] = [];
    for (const [key, list] of monthMap.entries()) {
      const desiredAmt = modeAmountByKey.get(key);
      const row = pickCanonicalIncomeRow(list, desiredAmt);
      if (!row) continue;
      chosen.push({ id: row.id, name: row.name, amount: decimalToNumber(row.amount) });
    }
    empty[monthKey] = chosen;
  }

  return empty;
}

export async function addIncome(
	budgetPlanId: string,
	month: MonthKey,
	item: Omit<IncomeItem, "id"> & { id?: string },
	yearOverride?: number
): Promise<void> {
  const year =
    typeof yearOverride === "number" && Number.isFinite(yearOverride)
      ? yearOverride
      : await resolveIncomeYear(budgetPlanId);
  const scope = await getEventIncomeScope(budgetPlanId);
  if (scope) {
    const monthNum = monthKeyToNumber(month);
    if (isAfterEventMonth({ incomeYear: year, incomeMonth: monthNum, scope })) {
      throw new Error("Income must be before or during the event month.");
    }
  }
  await prisma.income.create({
    data: {
      budgetPlanId,
      year,
      month: monthKeyToNumber(month),
      name: item.name,
      amount: item.amount,
      periodKey: getIncomePeriodKey({ year, month: monthKeyToNumber(month) }, await resolvePayDate(budgetPlanId)),
    },
  });
}

function normalizeIncomeNameForWrite(name: string): string {
  return String(name ?? "").trim().toLowerCase();
}

export async function addOrUpdateIncomeAcrossMonths(
  budgetPlanId: string,
  months: MonthKey[],
  item: Omit<IncomeItem, "id"> & { id?: string },
  yearOverride?: number
): Promise<void> {
	const year =
		typeof yearOverride === "number" && Number.isFinite(yearOverride)
			? yearOverride
			: await resolveIncomeYear(budgetPlanId);
	const scope = await getEventIncomeScope(budgetPlanId);
  const targetMonths = Array.from(new Set(months));
  const targetName = normalizeIncomeNameForWrite(item.name);

  for (const monthKey of targetMonths) {
		if (scope) {
			const monthNum = monthKeyToNumber(monthKey);
			if (isAfterEventMonth({ incomeYear: year, incomeMonth: monthNum, scope })) {
				throw new Error("Income must be before or during the event month.");
			}
		}
    const month = monthKeyToNumber(monthKey);
    const existing = await prisma.income.findFirst({
      where: {
        budgetPlanId,
        year,
        month,
        name: { equals: targetName, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.income.update({
        where: { id: existing.id },
        data: { name: item.name, amount: item.amount, periodKey: getIncomePeriodKey({ year, month }, await resolvePayDate(budgetPlanId)) },
      });
      continue;
    }

    await prisma.income.create({
      data: { budgetPlanId, year, month, name: item.name, amount: item.amount, periodKey: getIncomePeriodKey({ year, month }, await resolvePayDate(budgetPlanId)) },
    });
  }
}

export async function updateIncome(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  updates: Partial<Omit<IncomeItem, "id">>,
  yearOverride?: number
): Promise<void> {
  const year = typeof yearOverride === "number" && Number.isFinite(yearOverride) ? yearOverride : await resolveIncomeYear(budgetPlanId);
	await prisma.income.updateMany({
		where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
		data: updates,
	});
}

export async function removeIncome(
  budgetPlanId: string,
  month: MonthKey,
  id: string,
  yearOverride?: number
): Promise<void> {
  const year = typeof yearOverride === "number" && Number.isFinite(yearOverride) ? yearOverride : await resolveIncomeYear(budgetPlanId);
	await prisma.income.deleteMany({
		where: { id, budgetPlanId, year, month: monthKeyToNumber(month) },
	});
}
