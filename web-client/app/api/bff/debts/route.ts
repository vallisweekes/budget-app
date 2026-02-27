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

    const body = await request.json();

    const parsedDueDate = parseDueDateInput((body as any)?.dueDate);
    if (!parsedDueDate.ok) {
      return NextResponse.json({ error: parsedDueDate.error }, { status: 400 });
    }

    const parsedDueDay = parseOptionalInt((body as any)?.dueDay);
    if (!parsedDueDay.ok) {
      return NextResponse.json({ error: "Invalid dueDay" }, { status: 400 });
    }

    const parsedInstallmentMonths = parseOptionalInt((body as any)?.installmentMonths);
    if (!parsedInstallmentMonths.ok) {
      return NextResponse.json({ error: "Invalid installmentMonths" }, { status: 400 });
    }

    // Backward compatible mapping: older clients may still send "high_purchase".
    // The DB enum value is now "hire_purchase".
    const normalizedType = body?.type === "high_purchase" ? "hire_purchase" : body?.type;
		const requestedBudgetPlanId = typeof body?.budgetPlanId === "string" ? body.budgetPlanId : "";
		if (!requestedBudgetPlanId.trim()) {
			return NextResponse.json({ error: "budgetPlanId is required" }, { status: 400 });
		}
		const budgetPlanId = await resolveOwnedBudgetPlanId({ userId, budgetPlanId: requestedBudgetPlanId });
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

    const historicalPaidAmountRaw = typeof body?.historicalPaidAmount !== "undefined" ? body.historicalPaidAmount : 0;
    const historicalPaidAmount = Number(historicalPaidAmountRaw);
    if (!Number.isFinite(historicalPaidAmount) || historicalPaidAmount < 0) {
      return NextResponse.json({ error: "Invalid historicalPaidAmount" }, { status: 400 });
    }
    let paidAmount = typeof body?.paidAmount !== "undefined" ? body.paidAmount : historicalPaidAmount;
    let computedBalanceOverride: number | null = null;
    let computedHistoricalOverride: number | null = null;
    if (typeof (body as any)?.agreementFirstPaymentDate !== "undefined") {
      const baseline = computeAgreementBaseline({
        initialBalance: (body as any)?.initialBalance,
        monthlyPayment: (body as any)?.amount,
        annualInterestRatePct: (body as any)?.interestRate,
        installmentMonths: parsedInstallmentMonths.int,
        firstPaymentDate: (body as any)?.agreementFirstPaymentDate,
        missedMonths: (body as any)?.agreementMissedMonths,
        missedPaymentFee: (body as any)?.agreementMissedPaymentFee,
      });
      if ("error" in baseline) {
        return NextResponse.json({ error: baseline.error }, { status: 400 });
      }
      computedBalanceOverride = baseline.computedCurrentBalance;
      computedHistoricalOverride = baseline.historicalPaidAmount;
      if (typeof body?.paidAmount === "undefined") {
        paidAmount = baseline.historicalPaidAmount;
      }
    }
    const debt = await prisma.debt.create({
      data: {
        name: body.name,
				type: normalizedType,
        initialBalance: body.initialBalance,
        currentBalance: computedBalanceOverride ?? (body.currentBalance || body.initialBalance),
        amount: body.amount,
        paid: body.paid || false,
				paidAmount,
        historicalPaidAmount: String(computedHistoricalOverride ?? historicalPaidAmount),
        monthlyMinimum: body.monthlyMinimum || null,
        interestRate: body.interestRate || null,
        installmentMonths: parsedInstallmentMonths.int,
        dueDate: parsedDueDate.dueDate,
        dueDay: parsedDueDay.int,
        creditLimit: body.creditLimit || null,
        defaultPaymentSource: body.defaultPaymentSource || "income",
        defaultPaymentCardDebtId: body.defaultPaymentCardDebtId || null,
        sourceType: body.sourceType || null,
        sourceExpenseId: body.sourceExpenseId || null,
        sourceMonthKey: body.sourceMonthKey || null,
        sourceCategoryId: body.sourceCategoryId || null,
        sourceCategoryName: body.sourceCategoryName || null,
        sourceExpenseName: body.sourceExpenseName || null,
        budgetPlanId,
      },
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
