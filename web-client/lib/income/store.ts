import { MONTHS } from "@/lib/constants/time";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber, monthNumberToKey } from "@/lib/helpers/monthKey";
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
    orderBy: [{ month: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, amount: true, month: true },
  });

  for (const row of rows) {
		if (scope && resolvedYear === scope.eventYear && row.month > scope.eventMonth) {
			// Ignore income after the event month.
			continue;
		}
    const monthKey = monthNumberToKey(row.month);
    empty[monthKey].push({ id: row.id, name: row.name, amount: decimalToNumber(row.amount) });
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
    },
  });
}

function normalizeIncomeName(name: string): string {
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
  const targetName = normalizeIncomeName(item.name);

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
        data: { name: item.name, amount: item.amount },
      });
      continue;
    }

    await prisma.income.create({
      data: { budgetPlanId, year, month, name: item.name, amount: item.amount },
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
