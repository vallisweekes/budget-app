import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { computeAgreementBaseline } from "@/lib/debts/agreementBaseline";

export const runtime = "nodejs";

function parseDueDateInput(value: unknown): { ok: true; dueDate: Date | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, dueDate: null };

  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? { ok: true, dueDate: value }
      : { ok: false, error: "Invalid dueDate" };
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { ok: true, dueDate: null };

    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (ymd) {
      const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
      return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
    }

    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (dmy) {
      const d = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000Z`);
      return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
    }

    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? { ok: true, dueDate: d } : { ok: false, error: "Invalid dueDate" };
  }

  return { ok: false, error: "Invalid dueDate" };
}

function parseOptionalInt(value: unknown): { ok: true; int: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, int: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, error: "Invalid number" };
    return { ok: true, int: Math.trunc(value) };
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { ok: true, int: null };
    const parsed = Number.parseInt(s, 10);
    if (!Number.isFinite(parsed)) return { ok: false, error: "Invalid number" };
    return { ok: true, int: parsed };
  }
  return { ok: false, error: "Invalid number" };
}

function parseAgreementFirstPaymentDateInput(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  // Accept either YYYY-MM-DD (legacy) or DD/MM/YYYY (global app format).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const monthIndex = month - 1;
  const utc = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
  if (!Number.isFinite(utc.getTime())) return null;
  // Guard against JS date rollover (e.g. 31/02/2026).
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== monthIndex || utc.getUTCDate() !== day) return null;
  return utc;
}

function addMonthsUtcWithDay(firstPaymentDate: Date, monthOffset: number, dayOfMonth: number): Date {
  const y = firstPaymentDate.getUTCFullYear();
  const m = firstPaymentDate.getUTCMonth() + monthOffset;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const clampedDay = Math.max(1, Math.min(daysInMonth, Math.trunc(dayOfMonth)));
  return new Date(Date.UTC(y, m, clampedDay, 0, 0, 0, 0));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object") {
    const maybe = value as { toNumber?: () => unknown; toString?: () => unknown };
    if (typeof maybe.toNumber === "function") return Number(maybe.toNumber());
    if (typeof maybe.toString === "function") return Number(maybe.toString());
  }
  return Number(value);
}

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function withMissedPaymentFlag<T extends { sourceType?: string | null }>(debt: T): T & { isMissedPayment: boolean } {
  return {
    ...debt,
    isMissedPayment: debt.sourceType === "expense",
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const debts = await prisma.debt.findMany({
      where: { budgetPlanId },
      include: {
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(debts.map((debt) => withMissedPaymentFlag(debt)));
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    const parsedDueDate = parseDueDateInput(raw.dueDate);
    if (!parsedDueDate.ok) {
      return NextResponse.json({ error: parsedDueDate.error }, { status: 400 });
    }

    const parsedDueDay = parseOptionalInt(raw.dueDay);
    if (!parsedDueDay.ok) {
      return NextResponse.json({ error: "Invalid dueDay" }, { status: 400 });
    }

    const parsedInstallmentMonths = parseOptionalInt(raw.installmentMonths);
    if (!parsedInstallmentMonths.ok) {
      return NextResponse.json({ error: "Invalid installmentMonths" }, { status: 400 });
    }

    // Backward compatible mapping: older clients may still send "high_purchase".
    // The DB enum value is now "hire_purchase".
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const typeRaw = typeof raw.type === "string" ? raw.type : "";
    if (!typeRaw) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    type DebtTypeInput = "credit_card" | "store_card" | "loan" | "mortgage" | "hire_purchase" | "other";
    const normalizedType = typeRaw === "high_purchase" ? "hire_purchase" : typeRaw;
    const debtType = (
      normalizedType === "credit_card" ||
      normalizedType === "store_card" ||
      normalizedType === "loan" ||
      normalizedType === "mortgage" ||
      normalizedType === "hire_purchase" ||
      normalizedType === "other"
    )
      ? (normalizedType as DebtTypeInput)
      : null;
    if (!debtType) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const requestedBudgetPlanId = typeof raw.budgetPlanId === "string" ? raw.budgetPlanId : "";
    const budgetPlanId = await resolveOwnedBudgetPlanId({
      userId,
      budgetPlanId: requestedBudgetPlanId.trim() ? requestedBudgetPlanId : null,
    });
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const initialBalance = toNumber(raw.initialBalance);
    if (!Number.isFinite(initialBalance)) {
      return NextResponse.json({ error: "Invalid initialBalance" }, { status: 400 });
    }
    const currentBalanceRaw = toNumber(raw.currentBalance);
    const currentBalance = Number.isFinite(currentBalanceRaw) ? currentBalanceRaw : initialBalance;
    const amount = toNumber(raw.amount);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const paid = typeof raw.paid === "boolean" ? raw.paid : false;
    const sourceType = typeof raw.sourceType === "string" ? raw.sourceType : null;
    const creditLimit = raw.creditLimit == null ? null : toNumber(raw.creditLimit);
    const monthlyMinimum = raw.monthlyMinimum == null ? null : toNumber(raw.monthlyMinimum);
    const interestRate = raw.interestRate == null ? null : toNumber(raw.interestRate);
    type PaymentSourceInput = "income" | "extra_funds" | "credit_card";
    const defaultPaymentSource: PaymentSourceInput =
      raw.defaultPaymentSource === "extra_funds"
        ? "extra_funds"
        : raw.defaultPaymentSource === "credit_card"
          ? "credit_card"
          : "income";
    const defaultPaymentCardDebtId = typeof raw.defaultPaymentCardDebtId === "string" ? raw.defaultPaymentCardDebtId : null;
    const sourceExpenseId = typeof raw.sourceExpenseId === "string" ? raw.sourceExpenseId : null;
    const sourceMonthKey = typeof raw.sourceMonthKey === "string" ? raw.sourceMonthKey : null;
    const sourceCategoryId = typeof raw.sourceCategoryId === "string" ? raw.sourceCategoryId : null;
    const sourceCategoryName = typeof raw.sourceCategoryName === "string" ? raw.sourceCategoryName : null;
    const sourceExpenseName = typeof raw.sourceExpenseName === "string" ? raw.sourceExpenseName : null;

    const historicalPaidAmountRaw = typeof raw.historicalPaidAmount !== "undefined" ? raw.historicalPaidAmount : 0;
    const historicalPaidAmount = Number(historicalPaidAmountRaw);
    if (!Number.isFinite(historicalPaidAmount) || historicalPaidAmount < 0) {
      return NextResponse.json({ error: "Invalid historicalPaidAmount" }, { status: 400 });
    }
    let paidAmount = typeof raw.paidAmount !== "undefined" ? toNumber(raw.paidAmount) : historicalPaidAmount;
    let computedBalanceOverride: number | null = null;
    let computedHistoricalOverride: number | null = null;
    let agreementBackfill:
      | null
      | {
          firstPaymentDate: Date;
          paymentsMade: number;
          monthlyPayment: number;
          dayOfMonth: number;
          missedMonths: number;
        } = null;
    if (typeof raw.agreementFirstPaymentDate !== "undefined") {
      const baseline = computeAgreementBaseline({
        initialBalance,
        monthlyPayment: amount,
        annualInterestRatePct: interestRate,
        installmentMonths: parsedInstallmentMonths.int,
        firstPaymentDate: raw.agreementFirstPaymentDate,
        missedMonths: raw.agreementMissedMonths,
        missedPaymentFee: raw.agreementMissedPaymentFee,
      });
      if ("error" in baseline) {
        return NextResponse.json({ error: baseline.error }, { status: 400 });
      }
      computedBalanceOverride = baseline.computedCurrentBalance;
      computedHistoricalOverride = baseline.historicalPaidAmount;
      if (typeof raw.paidAmount === "undefined") {
        paidAmount = baseline.historicalPaidAmount;
      }

      const firstPaymentDate = parseAgreementFirstPaymentDateInput(raw.agreementFirstPaymentDate);
      const monthlyPayment = Math.max(0, amount);
      const missedMonthsRaw = toNumber(raw.agreementMissedMonths ?? 0);
      const missedMonths = Number.isFinite(missedMonthsRaw) ? Math.max(0, Math.trunc(missedMonthsRaw)) : 0;
      const dayOfMonth =
        parsedDueDay.int != null && Number.isFinite(parsedDueDay.int) && parsedDueDay.int > 0
          ? parsedDueDay.int
          : (firstPaymentDate ? firstPaymentDate.getUTCDate() : 1);

      if (sourceType !== "expense" && firstPaymentDate && monthlyPayment > 0 && baseline.paymentsMade > 0) {
        agreementBackfill = {
          firstPaymentDate,
          paymentsMade: baseline.paymentsMade,
          monthlyPayment,
          dayOfMonth,
          missedMonths,
        };
      }
    }
    const debt = await prisma.$transaction(async (tx) => {
      const created = await tx.debt.create({
        data: {
          name,
					type: debtType,
          initialBalance,
          currentBalance: computedBalanceOverride ?? currentBalance,
          amount,
          paid,
					paidAmount: agreementBackfill ? String(agreementBackfill.paymentsMade * agreementBackfill.monthlyPayment) : String(paidAmount),
          historicalPaidAmount: agreementBackfill ? "0" : String(computedHistoricalOverride ?? historicalPaidAmount),
          monthlyMinimum: monthlyMinimum || null,
          interestRate: interestRate || null,
          installmentMonths: parsedInstallmentMonths.int,
          dueDate: parsedDueDate.dueDate,
          dueDay: parsedDueDay.int,
          creditLimit: creditLimit || null,
          defaultPaymentSource,
          defaultPaymentCardDebtId,
          sourceType,
          sourceExpenseId,
          sourceMonthKey,
          sourceCategoryId,
          sourceCategoryName,
          sourceExpenseName,
          budgetPlanId,
        },
      });

      if (!agreementBackfill) return created;

      const now = new Date();
      const toCreate: Array<{
        debtId: string;
        amount: string;
        paidAt: Date;
        year: number;
        month: number;
        source: "income";
        notes: string;
      }> = [];
      for (let i = 0; i < agreementBackfill.paymentsMade; i += 1) {
        const paidAt = addMonthsUtcWithDay(agreementBackfill.firstPaymentDate, i, agreementBackfill.dayOfMonth);
        if (paidAt.getTime() > now.getTime()) continue;
        toCreate.push({
          debtId: created.id,
          amount: String(agreementBackfill.monthlyPayment),
          paidAt,
          year: paidAt.getUTCFullYear(),
          month: paidAt.getUTCMonth() + 1,
          source: "income",
          notes:
            agreementBackfill.missedMonths > 0
              ? "Backfilled from agreement (assumes missed months were most recent)"
              : "Backfilled from agreement (assumed on-time payments)",
        });
      }

      if (toCreate.length) {
        await tx.debtPayment.createMany({ data: toCreate });
      }

      return created;
    });

    return NextResponse.json(withMissedPaymentFlag(debt), { status: 201 });
  } catch (error) {
    console.error("Failed to create debt:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}
