import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "@/lib/prisma";
import {
  getMonthlyDebtPlan,
  getMonthlyPlannedDebtPaymentsOnly,
  getScheduledMonthlyDebtPayment,
} from "./getMonthlyDebtPlan";

type MockDebtRow = {
  id: string;
  name: string;
  amount: number;
  currentBalance: number;
  initialBalance: number;
  installmentMonths: number | null;
  monthlyMinimum: number;
  sourceType: string | null;
  type: string | null;
  paid: boolean;
  sourceExpenseName: string | null;
  sourceCategoryName: string | null;
  dueDate: Date | null;
  dueDay: number | null;
};

const VANQUIS_DEBT: MockDebtRow = {
  id: "vanquis",
  name: "VANQUIS CARD",
  amount: 200,
  currentBalance: 6043.95,
  initialBalance: 7000,
  installmentMonths: null,
  monthlyMinimum: 0,
  sourceType: null,
  type: "credit_card",
  paid: false,
  sourceExpenseName: null,
  sourceCategoryName: null,
  dueDate: new Date("2026-07-05T00:00:00.000Z"),
  dueDay: 5,
};

const NATWEST_DEBT: MockDebtRow = {
  id: "natwest",
  name: "NATWEST CARD",
  amount: 200,
  currentBalance: 7130.64,
  initialBalance: 9000,
  installmentMonths: null,
  monthlyMinimum: 0,
  sourceType: null,
  type: "credit_card",
  paid: false,
  sourceExpenseName: null,
  sourceCategoryName: null,
  dueDate: new Date("2026-07-09T00:00:00.000Z"),
  dueDay: 9,
};

async function withMockedDebtPlanDependencies<T>(params: {
  debts: MockDebtRow[];
  paidAll: number;
  paidIncome: number;
  run: () => Promise<T>;
}): Promise<T> {
  const prismaMock = prisma as unknown as {
    debt: {
      findMany: (...args: unknown[]) => Promise<MockDebtRow[]>;
    };
    debtPayment: {
      aggregate: (...args: unknown[]) => Promise<{ _sum: { amount: number } }>;
    };
  };
  const originalDebtFindMany = prismaMock.debt.findMany;
  const originalDebtPaymentAggregate = prismaMock.debtPayment.aggregate;

  prismaMock.debt.findMany = async () => params.debts;
  prismaMock.debtPayment.aggregate = async (args: { where?: { source?: string } }) => {
    if (args?.where?.source === "income") {
      return { _sum: { amount: params.paidIncome } };
    }
    return { _sum: { amount: params.paidAll } };
  };

  try {
    return await params.run();
  } finally {
    prismaMock.debt.findMany = originalDebtFindMany;
    prismaMock.debtPayment.aggregate = originalDebtPaymentAggregate;
  }
}

test("getScheduledMonthlyDebtPayment uses card minimum when provided", () => {
  const payment = getScheduledMonthlyDebtPayment({
    amount: 200,
    currentBalance: 600,
    initialBalance: 800,
    installmentMonths: null,
    monthlyMinimum: 350,
    sourceType: null,
    type: "credit_card",
  });

  assert.equal(payment, 350);
});

test("getScheduledMonthlyDebtPayment uses installment fallback for non-card debts", () => {
  const payment = getScheduledMonthlyDebtPayment({
    amount: 0,
    currentBalance: 900,
    initialBalance: 1200,
    installmentMonths: 12,
    monthlyMinimum: 0,
    sourceType: null,
    type: "loan",
  });

  assert.equal(payment, 100);
});

test("getScheduledMonthlyDebtPayment caps planned amount by current balance", () => {
  const payment = getScheduledMonthlyDebtPayment({
    amount: 250,
    currentBalance: 90,
    initialBalance: 250,
    installmentMonths: null,
    monthlyMinimum: 0,
    sourceType: null,
    type: "loan",
  });

  assert.equal(payment, 90);
});

test("getMonthlyDebtPlan keeps planned totals schedule-based even when paid totals spike", async () => {
  const result = await withMockedDebtPlanDependencies({
    debts: [VANQUIS_DEBT, NATWEST_DEBT],
    paidAll: 1473,
    paidIncome: 1473,
    run: () => getMonthlyDebtPlan({
      budgetPlanId: "plan_1",
      year: 2026,
      month: 7,
      periodKey: "2026-06-27",
      periodStart: new Date("2026-06-27T00:00:00.000Z"),
      periodEnd: new Date("2026-07-26T23:59:59.999Z"),
    }),
  });

  assert.equal(result.totalDueDebts, 400);
  assert.equal(result.plannedDebtPayments, 400);
  assert.equal(result.totalPaidDebtPayments, 1473);
  assert.equal(result.paidDebtPaymentsFromIncome, 1473);
  assert.equal(result.remainingDebtPayments, 0);
});

test("getMonthlyPlannedDebtPaymentsOnly returns scheduled obligations (no paid-spike drift)", async () => {
  const result = await withMockedDebtPlanDependencies({
    debts: [VANQUIS_DEBT, NATWEST_DEBT],
    paidAll: 0,
    paidIncome: 0,
    run: () => getMonthlyPlannedDebtPaymentsOnly({
      budgetPlanId: "plan_1",
      year: 2026,
      month: 7,
      periodStart: new Date("2026-06-27T00:00:00.000Z"),
      periodEnd: new Date("2026-07-26T23:59:59.999Z"),
    }),
  });

  assert.equal(result.plannedDebtPayments, 400);
});
