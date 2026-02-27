import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";
import { processMissedDebtPaymentsToAccrue } from "@/lib/debts/carryover";
import { computeDebtPayoffProjection } from "@/lib/debts/payoffProjection";
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

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function withMissedPaymentFlag<T extends { sourceType?: string | null }>(debt: T): T & { isMissedPayment: boolean } {
  return {
    ...debt,
    isMissedPayment: debt.sourceType === "expense",
  };
}

function withPayoffProjection<T extends {
  currentBalance?: unknown;
  amount?: unknown;
  monthlyMinimum?: unknown;
  installmentMonths?: unknown;
  initialBalance?: unknown;
  interestRate?: unknown;
}>(debt: T): T & {
  computedMonthlyPayment: number;
  computedMonthsLeft: number | null;
  computedPaidOffBy: string | null;
} {
  const projection = computeDebtPayoffProjection({
    currentBalance: (debt as any).currentBalance,
    plannedMonthlyPayment: (debt as any).amount,
    monthlyMinimum: (debt as any).monthlyMinimum,
    installmentMonths: (debt as any).installmentMonths,
    initialBalance: (debt as any).initialBalance,
    interestRatePct: (debt as any).interestRate,
    maxMonths: 60,
  });

  return {
    ...(debt as any),
    ...projection,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in (value as any) && typeof (value as any).toNumber === "function") {
    return Number((value as any).toNumber());
  }
  if (value && typeof value === "object" && "toString" in (value as any) && typeof (value as any).toString === "function") {
    return Number((value as any).toString());
  }
  return Number(value as any);
}

function mapDebtPaymentSourceToExpensePaymentSource(source: unknown): "income" | "extra_untracked" {
  return source === "income" ? "income" : "extra_untracked";
}

function paymentMatchKey(p: { amount: number; paidAt: Date }) {
  return `${p.amount.toFixed(2)}|${p.paidAt.toISOString()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return unauthorized();

    const { id } = await params;
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: {
				budgetPlan: { select: { userId: true } },
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!debt || debt.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    await processMissedDebtPaymentsToAccrue(debt.budgetPlanId);

    const refreshedDebt = await prisma.debt.findUnique({
      where: { id },
      include: {
        budgetPlan: { select: { userId: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!refreshedDebt || refreshedDebt.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

		const { budgetPlan, ...safe } = refreshedDebt;

    // Data integrity: for regular debts, `paidAmount` should equal the sum of recorded debt payments.
    // (Expense-derived debts can be affected by Expense payments that aren't mirrored as DebtPayment rows.)
    if (safe.sourceType !== "expense") {
      const paidAgg = await prisma.debtPayment.aggregate({
        where: { debtId: safe.id },
        _sum: { amount: true },
      });
      const computedPaid = Number((paidAgg._sum.amount as any)?.toString?.() ?? paidAgg._sum.amount ?? 0);
      const historicalPaid = Number((safe as any).historicalPaidAmount?.toString?.() ?? (safe as any).historicalPaidAmount ?? 0);
      const computedTotalPaid = computedPaid + (Number.isFinite(historicalPaid) ? historicalPaid : 0);
      const currentPaid = Number((safe.paidAmount as any)?.toString?.() ?? safe.paidAmount ?? 0);
      if (Number.isFinite(computedTotalPaid) && Math.abs(computedTotalPaid - currentPaid) > 0.009) {
        await prisma.debt.update({
          where: { id: safe.id },
          data: { paidAmount: computedTotalPaid },
        });
        (safe as any).paidAmount = String(computedTotalPaid);
      }
    } else if (safe.sourceExpenseId) {
      const expenseId = String(safe.sourceExpenseId).trim();
      if (expenseId) {
        const [expense, debtPayments, expensePayments] = await Promise.all([
          prisma.expense.findUnique({
            where: { id: expenseId },
            select: { id: true, amount: true },
          }),
          prisma.debtPayment.findMany({
            where: { debtId: safe.id },
            orderBy: { paidAt: "desc" },
          }),
          prisma.expensePayment.findMany({
            where: { expenseId },
            orderBy: { paidAt: "desc" },
          }),
        ]);

        if (expense) {
          const existingExpenseKeys = new Set(
            expensePayments.map((p) => paymentMatchKey({ amount: toNumber(p.amount), paidAt: p.paidAt }))
          );
          const toBackfill = debtPayments
            .map((p) => ({
              amount: toNumber(p.amount),
              paidAt: p.paidAt,
              source: mapDebtPaymentSourceToExpensePaymentSource((p as any).source),
            }))
            .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
            .filter((p) => !existingExpenseKeys.has(paymentMatchKey({ amount: p.amount, paidAt: p.paidAt })));

          if (toBackfill.length) {
            await prisma.expensePayment.createMany({
              data: toBackfill.map((p) => ({
                expenseId,
                amount: String(p.amount),
                source: p.source,
                debtId: safe.id,
                paidAt: p.paidAt,
              })),
            });
            for (const p of toBackfill) {
              expensePayments.push({
                id: `backfill_${p.paidAt.getTime()}_${p.amount}`,
                expenseId,
                amount: p.amount as any,
                source: p.source as any,
                debtId: safe.id,
                paidAt: p.paidAt,
                createdAt: p.paidAt,
                updatedAt: p.paidAt,
              } as any);
            }
          }

          const totalPaidRaw = expensePayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
          const expenseAmount = toNumber(expense.amount);
          const nextExpensePaid = Math.min(expenseAmount, Math.max(0, totalPaidRaw));
          const nextIsPaid = expenseAmount > 0 && nextExpensePaid >= expenseAmount;
          const nextDebtBalance = Math.max(0, expenseAmount - nextExpensePaid);

          const currentPaid = toNumber(safe.paidAmount);
          const currentBalance = toNumber(safe.currentBalance);
          if (
            Number.isFinite(nextExpensePaid) &&
            (Math.abs(nextExpensePaid - currentPaid) > 0.009 || Math.abs(nextDebtBalance - currentBalance) > 0.009)
          ) {
            await prisma.$transaction(async (tx) => {
              await tx.debt.update({
                where: { id: safe.id },
                data: {
                  paidAmount: String(nextExpensePaid),
                  currentBalance: String(nextDebtBalance),
                  paid: nextDebtBalance === 0,
                },
              });
              await tx.expense.update({
                where: { id: expenseId },
                data: {
                  paidAmount: String(nextExpensePaid),
                  paid: nextIsPaid,
                },
              });
            });
            (safe as any).paidAmount = String(nextExpensePaid);
            (safe as any).currentBalance = String(nextDebtBalance);
            (safe as any).paid = nextDebtBalance === 0;
          }
        }
      }
    }

    return NextResponse.json(withPayoffProjection(withMissedPaymentFlag(safe)));
  } catch (error) {
    console.error("Failed to fetch debt:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt" },
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

    const existing = await prisma.debt.findUnique({
      where: { id },
      include: { budgetPlan: { select: { userId: true } } },
    });
    if (!existing || existing.budgetPlan.userId !== userId) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    let agreementBackfill:
      | null
      | {
          firstPaymentDate: Date;
          paymentsMade: number;
          monthlyPayment: number;
          dayOfMonth: number;
          missedMonths: number;
        } = null;

    if (typeof raw.name === "string") data.name = raw.name;
    if (typeof raw.type === "string") data.type = raw.type;
    if (typeof raw.initialBalance !== "undefined") data.initialBalance = raw.initialBalance;
    if (typeof raw.currentBalance !== "undefined") data.currentBalance = raw.currentBalance;
    if (typeof raw.amount !== "undefined") data.amount = raw.amount;
    if (typeof raw.paid === "boolean") data.paid = raw.paid;
    if (typeof raw.paidAmount !== "undefined") data.paidAmount = raw.paidAmount;
    const hasExplicitPaidAmount = typeof raw.paidAmount !== "undefined";
    const hasExplicitHistoricalPaid = typeof (raw as any).historicalPaidAmount !== "undefined";
    if (hasExplicitHistoricalPaid) {
      const nextHistoricalRaw = toNumber((raw as any).historicalPaidAmount);
      if (!Number.isFinite(nextHistoricalRaw) || nextHistoricalRaw < 0) {
        return NextResponse.json({ error: "Invalid historicalPaidAmount" }, { status: 400 });
      }
      data.historicalPaidAmount = nextHistoricalRaw;

      // If the client is only setting a baseline (historicalPaidAmount), keep the in-app payment
      // portion intact by adjusting total paidAmount automatically.
      if (!hasExplicitPaidAmount) {
        const existingTotal = toNumber((existing as any).paidAmount);
        const existingHistorical = toNumber((existing as any).historicalPaidAmount);
        const paymentsPaid = Math.max(0, existingTotal - Math.max(0, existingHistorical));
        const nextHistorical = Math.max(0, nextHistoricalRaw);
        data.paidAmount = paymentsPaid + nextHistorical;
      }
    }
    if (typeof raw.monthlyMinimum !== "undefined") data.monthlyMinimum = raw.monthlyMinimum;
    if (typeof raw.interestRate !== "undefined") data.interestRate = raw.interestRate;
    if (typeof raw.dueDate !== "undefined") {
      const parsed = parseDueDateInput(raw.dueDate);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      data.dueDate = parsed.dueDate;
    }
    if (typeof raw.dueDay !== "undefined") {
      const parsed = parseOptionalInt(raw.dueDay);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid dueDay" }, { status: 400 });
      data.dueDay = parsed.int;
    }
    if (typeof raw.installmentMonths !== "undefined") {
      const parsed = parseOptionalInt(raw.installmentMonths);
      if (!parsed.ok) return NextResponse.json({ error: "Invalid installmentMonths" }, { status: 400 });
      data.installmentMonths = parsed.int;
    }

    // Agreement baseline (for loans that started before tracking in-app)
    if (typeof (raw as any).agreementFirstPaymentDate !== "undefined") {
      const agreementFirstRaw = (raw as any).agreementFirstPaymentDate;

      // Allow clearing the field.
      if (agreementFirstRaw == null || (typeof agreementFirstRaw === "string" && !agreementFirstRaw.trim())) {
        data.historicalPaidAmount = 0;
        if (!hasExplicitPaidAmount) {
          const existingTotal = toNumber((existing as any).paidAmount);
          const existingHistorical = toNumber((existing as any).historicalPaidAmount);
          const paymentsPaid = Math.max(0, existingTotal - Math.max(0, existingHistorical));
          data.paidAmount = paymentsPaid;
        }
      } else {
      const baseline = computeAgreementBaseline({
        initialBalance: typeof raw.initialBalance !== "undefined" ? raw.initialBalance : (existing as any).initialBalance,
        monthlyPayment: typeof raw.amount !== "undefined" ? raw.amount : (existing as any).amount,
        annualInterestRatePct: typeof raw.interestRate !== "undefined" ? raw.interestRate : (existing as any).interestRate,
        installmentMonths:
          typeof raw.installmentMonths !== "undefined" ? (data as any).installmentMonths : (existing as any).installmentMonths,
        firstPaymentDate: (raw as any).agreementFirstPaymentDate,
        missedMonths: (raw as any).agreementMissedMonths,
        missedPaymentFee: (raw as any).agreementMissedPaymentFee,
      });
      if ("error" in baseline) {
        return NextResponse.json({ error: baseline.error }, { status: 400 });
      }

      data.historicalPaidAmount = baseline.historicalPaidAmount;
      // Keep the in-app payment portion intact when re-baselining.
      const existingTotal = toNumber((existing as any).paidAmount);
      const existingHistorical = toNumber((existing as any).historicalPaidAmount);
      const paymentsPaid = Math.max(0, existingTotal - Math.max(0, existingHistorical));
      data.paidAmount = paymentsPaid + baseline.historicalPaidAmount;
      // Optionally override current balance based on the agreement schedule.
      data.currentBalance = baseline.computedCurrentBalance;
      data.paid = baseline.computedCurrentBalance === 0;

      // If the user reports no missed payments, we can backfill the payment history into real rows.
      // This is idempotent and avoids duplicates by month.
      const missedMonthsRaw = toNumber((raw as any).agreementMissedMonths);
      const missedMonths = Number.isFinite(missedMonthsRaw) ? Math.max(0, Math.trunc(missedMonthsRaw)) : 0;
      if (existing.sourceType !== "expense") {
        const firstPaymentDate = parseAgreementFirstPaymentDateInput(agreementFirstRaw);
        const monthlyPayment = Math.max(0, toNumber(typeof raw.amount !== "undefined" ? raw.amount : (existing as any).amount));
        const dayOfMonthCandidate =
          typeof raw.dueDay !== "undefined"
            ? (data as any).dueDay
            : (existing as any).dueDay;
        const dayOfMonth =
          Number.isFinite(dayOfMonthCandidate) && Math.trunc(dayOfMonthCandidate) > 0
            ? Math.trunc(dayOfMonthCandidate)
            : (firstPaymentDate ? firstPaymentDate.getUTCDate() : 1);

        if (firstPaymentDate && monthlyPayment > 0 && baseline.paymentsMade > 0) {
          agreementBackfill = {
            firstPaymentDate,
            paymentsMade: baseline.paymentsMade,
            monthlyPayment,
            dayOfMonth,
            missedMonths,
          };
        }
      }
      }
    }
    if (typeof raw.creditLimit !== "undefined") data.creditLimit = raw.creditLimit;
    if (typeof raw.defaultPaymentSource !== "undefined") data.defaultPaymentSource = raw.defaultPaymentSource;
    if (typeof raw.defaultPaymentCardDebtId !== "undefined") data.defaultPaymentCardDebtId = raw.defaultPaymentCardDebtId;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const debt = await prisma.$transaction(async (tx) => {
      const updated = await tx.debt.update({
        where: { id },
        data,
      });

      if (!agreementBackfill) return updated;

      const now = new Date();
      const existingPayments = await tx.debtPayment.findMany({
        where: {
          debtId: id,
          paidAt: { gte: agreementBackfill.firstPaymentDate, lte: now },
        },
        select: { year: true, month: true },
      });
      const existingMonthKeys = new Set(existingPayments.map((p) => `${p.year}-${p.month}`));

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
        const year = paidAt.getUTCFullYear();
        const month = paidAt.getUTCMonth() + 1;
        const key = `${year}-${month}`;
        if (existingMonthKeys.has(key)) continue;
        existingMonthKeys.add(key);
        toCreate.push({
          debtId: id,
          amount: String(agreementBackfill.monthlyPayment),
          paidAt,
          year,
          month,
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

      // Once payments are represented as rows, avoid double-counting via historicalPaidAmount.
      const paidAgg = await tx.debtPayment.aggregate({
        where: { debtId: id },
        _sum: { amount: true },
      });
      const totalPaidFromRows = Math.max(0, toNumber(paidAgg._sum.amount ?? 0));

      return await tx.debt.update({
        where: { id },
        data: {
          historicalPaidAmount: 0,
          paidAmount: String(totalPaidFromRows),
        },
      });
    });

    return NextResponse.json(withMissedPaymentFlag(debt));
  } catch (error) {
    console.error("Failed to update debt:", error);
    return NextResponse.json(
      { error: "Failed to update debt" },
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
		const existing = await prisma.debt.findUnique({
			where: { id },
			include: { budgetPlan: { select: { userId: true } } },
		});
		if (!existing || existing.budgetPlan.userId !== userId) {
			return NextResponse.json({ error: "Debt not found" }, { status: 404 });
		}
    if (existing.sourceType === "expense" && Number(existing.currentBalance) > 0) {
      return NextResponse.json(
        { error: "Cannot delete an unpaid expense debt. Mark the expense as paid first." },
        { status: 409 }
      );
    }

    await prisma.debt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete debt:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 }
    );
  }
}
