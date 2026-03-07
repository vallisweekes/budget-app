import { MONTHS } from "@/lib/constants/time";
import { prisma } from "@/lib/prisma";
import { monthKeyToNumber, monthNumberToKey } from "@/lib/helpers/monthKey";
import { getIncomePeriodKey, getLegacyIncomePeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";
import { canonicalizeIncomeName } from "@/lib/income/name";
import { normalizePayFrequency } from "@/lib/payPeriods";
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

function pickCanonicalIncomeRow<T extends { name: string; updatedAt: Date; createdAt: Date }>(
  rows: T[],
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

    // For same-name duplicates in the same month, keep the earliest created row
    // so historical month values remain stable and later accidental duplicates
    // don't override the original amount.
    if (row.createdAt.getTime() !== best.createdAt.getTime()) {
      best = row.createdAt < best.createdAt ? row : best;
      continue;
    }
    if (row.updatedAt.getTime() !== best.updatedAt.getTime()) {
      best = row.updatedAt < best.updatedAt ? row : best;
    }
  }
  return best;
}

type EventIncomeScope = {
  kind: string;
  eventYear: number;
  eventMonth: number; // 1-12
};

type IncomeCadence = "monthly" | "every_2_weeks" | "weekly";

type IncomeWriteContext = {
  payDate: number;
  payFrequency: IncomeCadence;
  scope: EventIncomeScope | null;
};

async function resolveIncomeCadence(budgetPlanId: string): Promise<IncomeCadence> {
  const plan = await prisma.budgetPlan.findUnique({
    where: { id: budgetPlanId },
    select: { userId: true },
  });
  if (!plan?.userId) return "monthly";

  try {
    const profile = await prisma.userOnboardingProfile.findUnique({
      where: { userId: plan.userId },
      select: { payFrequency: true },
    });
    return normalizePayFrequency(profile?.payFrequency);
  } catch {
    return "monthly";
  }
}

async function resolveIncomeWriteContext(budgetPlanId: string): Promise<IncomeWriteContext> {
  const [scope, payFrequency, payDate] = await Promise.all([
    getEventIncomeScope(budgetPlanId),
    resolveIncomeCadence(budgetPlanId),
    resolvePayDate(budgetPlanId),
  ]);

  return { scope, payFrequency, payDate };
}

function assertIncomeWithinScope(scope: EventIncomeScope | null, year: number, month: number): void {
  if (scope && isAfterEventMonth({ incomeYear: year, incomeMonth: month, scope })) {
    throw new Error("Income must be before or during the event month.");
  }
}

function buildIncomePeriodKeyForAnchor(
  income: { year: number; month: number },
  context: Pick<IncomeWriteContext, "payDate" | "payFrequency">
): string {
  return getIncomePeriodKey(income, context.payDate, context.payFrequency);
}

async function findExistingIncomeRowsForAnchor(params: {
  budgetPlanId: string;
  year: number;
  month: number;
  name: string;
  periodKey: string;
  excludeId?: string;
}): Promise<Array<{ id: string; name: string; updatedAt: Date; createdAt: Date }>> {
  const { budgetPlanId, year, month, name, periodKey, excludeId } = params;
  return prisma.income.findMany({
    where: {
      budgetPlanId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { year, month },
        { periodKey },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, updatedAt: true, createdAt: true },
  });
}

export async function upsertIncomeForAnchorMonth(params: {
  budgetPlanId: string;
  year: number;
  month: number;
  name: string;
  amount: number;
}): Promise<{ id: string; name: string; amount: number; year: number; month: number; periodKey: string | null }> {
  const { budgetPlanId, year, month, amount } = params;
  const name = canonicalizeIncomeName(params.name);
  const context = await resolveIncomeWriteContext(budgetPlanId);
  assertIncomeWithinScope(context.scope, year, month);

  const periodKey = buildIncomePeriodKeyForAnchor({ year, month }, context);
  const existing = await findExistingIncomeRowsForAnchor({ budgetPlanId, year, month, name, periodKey });

  if (existing.length > 0) {
    const canonical = pickCanonicalIncomeRow(existing);
    const updated = await prisma.income.update({
      where: { id: canonical!.id },
      data: { budgetPlanId, year, month, name, amount, periodKey },
      select: { id: true, name: true, amount: true, year: true, month: true, periodKey: true },
    });

    const duplicateIds = existing.filter((row) => row.id !== canonical!.id).map((row) => row.id);
    if (duplicateIds.length > 0) {
      await prisma.income.deleteMany({ where: { id: { in: duplicateIds } } });
    }

    return { ...updated, amount: decimalToNumber(updated.amount) };
  }

  const created = await prisma.income.create({
    data: { budgetPlanId, year, month, name, amount, periodKey },
    select: { id: true, name: true, amount: true, year: true, month: true, periodKey: true },
  });
  return { ...created, amount: decimalToNumber(created.amount) };
}

function pickIncomeRowForAnchor<T extends { name: string; year: number; month: number; periodKey: string | null; updatedAt: Date; createdAt: Date }>(
  rows: T[],
  params: { year: number; month: number; canonicalPeriodKey: string }
): T | null {
  if (!rows || rows.length === 0) return null;

  const canonicalRows = rows.filter((row) => row.periodKey === params.canonicalPeriodKey);
  if (canonicalRows.length > 0) {
    return pickCanonicalIncomeRow(canonicalRows);
  }

  const monthRows = rows.filter((row) => row.year === params.year && row.month === params.month);
  if (monthRows.length > 0) {
    return pickCanonicalIncomeRow(monthRows);
  }

  return pickCanonicalIncomeRow(rows);
}

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
  const payFrequency = await resolveIncomeCadence(budgetPlanId);
  const payDate = payFrequency === "monthly" ? await resolvePayDate(budgetPlanId) : null;

	if (scope && resolvedYear > scope.eventYear) {
		// All months are after the event year.
		return empty;
	}

  const rows = await prisma.income.findMany({
    where: { budgetPlanId, year: resolvedYear },
    orderBy: [{ month: "asc" }, { updatedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, amount: true, month: true, year: true, periodKey: true, createdAt: true, updatedAt: true },
  });

  const candidatesByMonth = new Map<MonthKey, Map<string, Array<(typeof rows)[number]>>>(
    MONTHS.map((m) => [m, new Map()])
  );
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

  }

  for (const monthKey of MONTHS) {
    const monthMap = candidatesByMonth.get(monthKey);
    if (!monthMap) continue;
    const chosen: IncomeItem[] = [];
    const monthNumber = monthKeyToNumber(monthKey);
    const canonicalPeriodKey = payFrequency === "monthly" && payDate != null
      ? getIncomePeriodKey({ year: resolvedYear, month: monthNumber }, payDate, payFrequency)
      : null;
    for (const list of monthMap.values()) {
      const row = canonicalPeriodKey
        ? pickIncomeRowForAnchor(list, { year: resolvedYear, month: monthNumber, canonicalPeriodKey })
        : pickCanonicalIncomeRow(list);
      if (!row) continue;
      chosen.push({ id: row.id, name: row.name, amount: decimalToNumber(row.amount) });
    }
    empty[monthKey] = chosen;
  }

  return empty;
}

export async function getIncomeForAnchorMonth(params: {
  budgetPlanId: string;
  year: number;
  month: number;
  scope?: EventIncomeScope | null;
  payDate?: number | null;
  payFrequency?: IncomeCadence | null;
}): Promise<IncomeItem[]> {
  const { budgetPlanId, year, month } = params;
  const monthKey = monthNumberToKey(month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12);
  const scope = typeof params.scope === "undefined" ? await getEventIncomeScope(budgetPlanId) : params.scope;
  if (scope && isAfterEventMonth({ incomeYear: year, incomeMonth: month, scope })) {
    return [];
  }

  const payFrequency = params.payFrequency ?? await resolveIncomeCadence(budgetPlanId);
  const payDate = payFrequency === "monthly"
    ? (params.payDate ?? await resolvePayDate(budgetPlanId))
    : 27;

  const canonicalPeriodKey = getIncomePeriodKey({ year, month }, payDate, payFrequency);

  const rows = await prisma.income.findMany({
    where: {
      budgetPlanId,
      OR: [
        { year, month },
        { periodKey: canonicalPeriodKey },
      ],
    },
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, amount: true, month: true, year: true, periodKey: true, createdAt: true, updatedAt: true },
  });

  const chosenByName = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    if (row.year !== year || row.month !== month) {
      if (row.periodKey !== canonicalPeriodKey) continue;
    }
    const key = normalizeIncomeName(row.name);
    if (!key) continue;
    const bucket = chosenByName.get(key) ?? [];
    bucket.push(row);
    chosenByName.set(key, bucket);
  }

  const result: IncomeItem[] = [];
  for (const rowsForName of chosenByName.values()) {
    const row = payFrequency === "monthly"
      ? pickIncomeRowForAnchor(rowsForName, { year, month, canonicalPeriodKey })
      : pickCanonicalIncomeRow(rowsForName);
    if (!row) continue;
    result.push({ id: row.id, name: row.name, amount: decimalToNumber(row.amount) });
  }

  if (monthKey && MONTHS.includes(monthKey)) {
    result.sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));
  }
  return result;
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
  await upsertIncomeForAnchorMonth({
    budgetPlanId,
    year,
    month: monthKeyToNumber(month),
    name: item.name,
    amount: item.amount,
  });
}

function normalizeIncomeNameForWrite(name: string): string {
  return canonicalizeIncomeName(name).toLowerCase();
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
  const targetMonths = Array.from(new Set(months));

  for (const monthKey of targetMonths) {
    const month = monthKeyToNumber(monthKey);
    await upsertIncomeForAnchorMonth({
      budgetPlanId,
      year,
      month,
      name: item.name,
      amount: item.amount,
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
  const existing = await prisma.income.findFirst({
    where: { id, budgetPlanId },
    select: { id: true, name: true, amount: true, year: true, month: true },
  });
  if (!existing) return;

  const nextYear = typeof yearOverride === "number" && Number.isFinite(yearOverride) ? yearOverride : existing.year;
  const nextMonth = monthKeyToNumber(month);
  const nextName = typeof updates.name === "string" && updates.name.trim() ? updates.name : existing.name;
  const nextAmount = typeof updates.amount === "number" && Number.isFinite(updates.amount) ? updates.amount : existing.amount;
  const context = await resolveIncomeWriteContext(budgetPlanId);
  assertIncomeWithinScope(context.scope, nextYear, nextMonth);

  const canonicalName = canonicalizeIncomeName(nextName);
  const periodKey = buildIncomePeriodKeyForAnchor({ year: nextYear, month: nextMonth }, context);

  await prisma.$transaction(async (tx) => {
    await tx.income.update({
      where: { id },
      data: { name: canonicalName, amount: nextAmount, year: nextYear, month: nextMonth, periodKey },
    });

    const duplicates = await tx.income.findMany({
      where: {
        budgetPlanId,
        name: { equals: canonicalName, mode: "insensitive" },
        id: { not: id },
        OR: [
          { year: nextYear, month: nextMonth },
          { periodKey },
        ],
      },
      select: { id: true },
    });

    if (duplicates.length > 0) {
      await tx.income.deleteMany({ where: { id: { in: duplicates.map((row) => row.id) } } });
    }
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
