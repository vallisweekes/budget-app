import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportsExpenseMovedToDebtField } from "@/lib/prisma/capabilities";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { resolveBudgetPlanPayPeriodContext } from "@/lib/api/payPeriodContext";
import { processOverdueExpensesToDebts } from "@/lib/expenses/carryover";
import { resolveEffectiveDueDateIso } from "@/lib/expenses/insights";
import { resolveMatchedExpensePeriodKey } from "@/lib/helpers/periodKey";
import { buildPayPeriodFromMonthAnchor, normalizePayFrequency, type PayFrequency } from "@/lib/payPeriods";
import { isLegacyPlaceholderExpenseRow } from "@/lib/expenses/legacyPlaceholders";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function toN(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value: unknown): number {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value ?? "0"));
  return Number.isNaN(n) ? 0 : n;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function inRange(target: Date, start: Date, end: Date): boolean {
  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

function includeInMainExpenseSummary(expense: {
  isExtraLoggedExpense?: boolean | null;
  paymentSource?: string | null;
}): boolean {
  return !Boolean(expense.isExtraLoggedExpense ?? false);
}

function isUnknownMovedToDebtFieldError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error);
  return (
    message.includes("isMovedToDebt") &&
    (message.includes("Unknown arg") || message.includes("Unknown argument") || message.includes("Unknown field"))
  );
}

function resolvePickerAnchorYear(params: {
  displayYear: number;
  month: number;
  payFrequency: PayFrequency;
}): number {
  const { displayYear, month, payFrequency } = params;
  if (payFrequency === "monthly" && month === 1) {
    return displayYear + 1;
  }
  return displayYear;
}

type ExpenseRow = {
  id: string;
  name: string;
  amount: unknown;
  isAllocation?: boolean | null;
  isExtraLoggedExpense?: boolean | null;
  paymentSource?: string | null;
  seriesKey?: string | null;
  dueDate: Date | null;
  month: number;
  year: number;
  periodKey?: string | null;
};

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const year = toN(searchParams.get("year"));
  if (year == null || year < 1900) return badRequest("Invalid year");

  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId: searchParams.get("budgetPlanId"),
  });
  if (!budgetPlanId) {
    return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
  }

  void processOverdueExpensesToDebts(budgetPlanId).catch((error) => {
    console.error("Expense pay-period months: overdue carryover sync failed:", error);
  });

  const payPeriodContext = await resolveBudgetPlanPayPeriodContext({ budgetPlanId });

  const payDate = Number.isFinite(Number(payPeriodContext.payDate)) && Number(payPeriodContext.payDate) >= 1
    ? Math.floor(Number(payPeriodContext.payDate))
    : 1;
  const payAnchorDate = payPeriodContext.payAnchorDate;
  const payFrequency: PayFrequency = normalizePayFrequency(payPeriodContext.payFrequency);
  const firstSelectableStart = payPeriodContext.firstSelectableWindow.start;

  const periods = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const anchorYear = resolvePickerAnchorYear({
      displayYear: year,
      month,
      payFrequency,
    });
    const selected = buildPayPeriodFromMonthAnchor({
      anchorYear,
      anchorMonth: month,
      payDate,
      payFrequency,
      payAnchorDate,
    });
    return {
      month,
      year,
      key: selected.start.toISOString().slice(0, 10),
      start: selected.start,
      end: selected.end,
      allowedUnscheduledYm: new Set([
        `${selected.start.getUTCFullYear()}-${selected.start.getUTCMonth() + 1}`,
        `${selected.end.getUTCFullYear()}-${selected.end.getUTCMonth() + 1}`,
      ]),
      windowPairs: [
        { year: selected.start.getUTCFullYear(), month: selected.start.getUTCMonth() + 1 },
        { year: selected.end.getUTCFullYear(), month: selected.end.getUTCMonth() + 1 },
        {
          year: new Date(Date.UTC(selected.start.getUTCFullYear(), selected.start.getUTCMonth() - 1, 1)).getUTCFullYear(),
          month: new Date(Date.UTC(selected.start.getUTCFullYear(), selected.start.getUTCMonth() - 1, 1)).getUTCMonth() + 1,
        },
        {
          year: new Date(Date.UTC(selected.end.getUTCFullYear(), selected.end.getUTCMonth() + 1, 1)).getUTCFullYear(),
          month: new Date(Date.UTC(selected.end.getUTCFullYear(), selected.end.getUTCMonth() + 1, 1)).getUTCMonth() + 1,
        },
      ],
    };
  });

  const uniquePairs = Array.from(
    new Map(periods.flatMap((period) => period.windowPairs).map((pair) => [`${pair.year}-${pair.month}`, pair])).values()
  );

  const rows = await (async () => {
    const runLegacyQuery = () =>
      prisma.expense.findMany({
        where: {
          budgetPlanId,
          OR: uniquePairs,
        },
        orderBy: { createdAt: "asc" },
      });

    if (!(await supportsExpenseMovedToDebtField())) {
      return runLegacyQuery();
    }

    try {
      return await prisma.expense.findMany({
        where: {
          budgetPlanId,
          OR: uniquePairs,
          isMovedToDebt: false,
        },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      if (!isUnknownMovedToDebtFieldError(error)) throw error;
      return runLegacyQuery();
    }
  })();

  const summaries = periods.map((period) => {
    if (period.start.getTime() < firstSelectableStart.getTime()) {
      return {
        month: period.month,
        year: period.year,
        periodKey: period.key,
        totalCount: 0,
        totalAmount: 0,
      };
    }

    const seen = new Map<string, { exp: ExpenseRow; rank: number }>();

    for (const exp of rows as ExpenseRow[]) {
      if (isLegacyPlaceholderExpenseRow(exp)) continue;
      if (Boolean(exp.isAllocation ?? false)) continue;

      let dedupeScope = "";
      let rank = 1;

      if (exp.dueDate) {
        const dueIso = resolveEffectiveDueDateIso(
          {
            id: exp.id,
            name: exp.name,
            amount: toFloat(exp.amount),
            paid: false,
            paidAmount: 0,
            dueDate: exp.dueDate ? exp.dueDate.toISOString().slice(0, 10) : undefined,
          },
          { year: exp.year, monthNum: exp.month, payDate }
        );
        if (!dueIso) continue;
        const due = parseIsoDate(dueIso);
        if (!due || !inRange(due, period.start, period.end)) continue;
        dedupeScope = dueIso;
        const ym = { year: Number(dueIso.slice(0, 4)), month: Number(dueIso.slice(5, 7)) };
        rank = exp.year === ym.year && exp.month === ym.month ? 0 : 1;
      } else {
        if (exp.periodKey) {
      const matchedPeriodKey = resolveMatchedExpensePeriodKey({
      storedPeriodKey: exp.periodKey,
      selectedPeriodStart: period.start,
      anchorYear: period.year,
      anchorMonth: period.month,
      payFrequency,
      });
      if (!matchedPeriodKey) continue;
      dedupeScope = `unscheduled:${matchedPeriodKey}`;
        } else {
          if (!period.allowedUnscheduledYm.has(`${exp.year}-${exp.month}`)) continue;
          dedupeScope = `unscheduled:${exp.year}-${exp.month}`;
        }
        rank = 0;
      }

      const series = String(exp.seriesKey ?? exp.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      const amount = toFloat(exp.amount);
      const key = `${series}|${dedupeScope}|${amount}`;
      const existing = seen.get(key);
      if (!existing || rank < existing.rank) {
        seen.set(key, { exp, rank });
      }
    }

    const mainExpenses = Array.from(seen.values())
      .map((entry) => entry.exp)
      .filter(includeInMainExpenseSummary);

    return {
      month: period.month,
      year: period.year,
      periodKey: period.key,
      totalCount: mainExpenses.length,
      totalAmount: parseFloat(mainExpenses.reduce((sum, exp) => sum + toFloat(exp.amount), 0).toFixed(2)),
    };
  });

  return NextResponse.json({
    year,
    payDate,
    payFrequency,
    months: summaries,
  });
}
