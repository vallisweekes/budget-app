import { enforceServerOnlyRuntime } from "@/lib/serverOnly";

enforceServerOnlyRuntime();

import { isCreditLikeDebtType, isLoanLikeDebtType } from "@/lib/expenses/paymentSource";
import { prisma } from "@/lib/prisma";
import { normalizeCreditLikeCurrentBalance } from "@/lib/debts/cardBalanceSemantics";
import { getSettings, saveSettings } from "@/lib/settings/store";
import { getPaymentPeriodKey, resolvePayDate } from "@/lib/helpers/periodKey";

export type NormalizedExpensePaymentSource =
  | "income"
  | "savings"
  | "credit_card"
  | "emergency"
  | "extra_untracked";

type PaymentSyncDbClient = {
  expensePayment: typeof prisma.expensePayment;
  expense: typeof prisma.expense;
  debt: typeof prisma.debt;
};

type DebtFundingKind = "credit_card" | "loan";

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  const asObj = value as { toString?: () => string };
  return Number(asObj?.toString?.() ?? value);
}

function normalizeExpensePaymentSource(value: unknown): NormalizedExpensePaymentSource {
  const raw = String(value ?? "").trim();
  if (raw === "income") return "income";
  if (raw === "savings") return "savings";
  if (raw === "credit_card") return "credit_card";
  if (raw === "emergency") return "emergency";
  if (raw === "extra_untracked") return "extra_untracked";
  return "extra_untracked";
}

export function mapDebtPaymentSourceToExpensePaymentSource(value: unknown): NormalizedExpensePaymentSource {
  const raw = String(value ?? "").trim();
  if (raw === "income") return "income";
  if (raw === "credit_card") return "credit_card";
  if (raw === "extra_funds") return "extra_untracked";
  return normalizeExpensePaymentSource(raw);
}

function getExpensePaymentDelegate(client: unknown): typeof prisma.expensePayment | null {
	return (client as Partial<PaymentSyncDbClient>)?.expensePayment ?? null;
}

async function resolveDebtFundingId(params: {
	tx: PaymentSyncDbClient;
  budgetPlanId: string;
  requestedDebtId?: string | null;
  kind: DebtFundingKind;
}): Promise<string | null> {
  const requestedDebtId = String(params.requestedDebtId ?? "").trim();
  const matchesKind = (value: unknown) =>
    params.kind === "credit_card" ? isCreditLikeDebtType(value) : isLoanLikeDebtType(value);

  if (requestedDebtId) {
    const requestedDebt = await params.tx.debt.findFirst({
      where: { id: requestedDebtId, budgetPlanId: params.budgetPlanId, sourceType: null },
      select: { id: true, type: true },
    });
    if (requestedDebt && matchesKind((requestedDebt as unknown as { type?: unknown }).type)) {
      return requestedDebt.id;
    }
  }

  const debts = await params.tx.debt.findMany({
    where: { budgetPlanId: params.budgetPlanId, sourceType: null },
    select: { id: true, type: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const matchingDebts = debts.filter((debt) => matchesKind((debt as unknown as { type?: unknown }).type));
  if (matchingDebts.length === 1) return matchingDebts[0]!.id;
  return null;
}

async function resolveCreditCardDebtId(params: {
	tx: PaymentSyncDbClient;
  budgetPlanId: string;
  requestedDebtId?: string | null;
}): Promise<string | null> {
  return resolveDebtFundingId({
	tx: params.tx,
    budgetPlanId: params.budgetPlanId,
    requestedDebtId: params.requestedDebtId,
    kind: "credit_card",
  });
}

async function applyCreditCardCharge(params: {
  tx: PaymentSyncDbClient;
  budgetPlanId: string;
  debtId: string;
  amount: number;
}) {
  const delta = Number(params.amount);
  if (!Number.isFinite(delta) || delta <= 0) return;

  const card = await params.tx.debt.findFirst({
    where: { id: params.debtId, budgetPlanId: params.budgetPlanId, sourceType: null },
    select: { id: true, type: true, currentBalance: true, initialBalance: true, paidAmount: true, creditLimit: true },
  });
  if (!card) return;

  const [expenseChargesAgg, debtChargesAgg, cardPaymentsAgg] = await Promise.all([
    params.tx.expensePayment.aggregate({
      where: { debtId: card.id },
      _sum: { amount: true },
    }),
    params.tx.debtPayment.aggregate({
      where: { cardDebtId: card.id },
      _sum: { amount: true },
    }),
    params.tx.debtPayment.aggregate({
      where: { debtId: card.id },
      _sum: { amount: true },
    }),
  ]);

  const current = normalizeCreditLikeCurrentBalance({
    type: card.type,
    currentBalance: (card as unknown as { currentBalance?: unknown }).currentBalance,
    creditLimit: (card as unknown as { creditLimit?: unknown }).creditLimit,
    trackedExpenseCharges: expenseChargesAgg._sum.amount,
    trackedDebtCharges: debtChargesAgg._sum.amount,
    trackedPayments: cardPaymentsAgg._sum.amount,
  });
  const initial = decimalToNumber((card as unknown as { initialBalance?: unknown }).initialBalance);
  const paidAmount = decimalToNumber((card as unknown as { paidAmount?: unknown }).paidAmount);

  const nextCurrent = Math.max(0, current + delta);
  const nextInitial = Math.max(initial, nextCurrent);
  const nextPaidAmount = Math.min(Math.max(0, paidAmount), nextInitial);

  await params.tx.debt.update({
    where: { id: card.id },
    data: {
      currentBalance: String(nextCurrent),
      initialBalance: String(nextInitial),
      paidAmount: String(nextPaidAmount),
      paid: false,
    },
  });
}

export async function syncExpensePaymentsToPaidAmount(params: {
	tx?: PaymentSyncDbClient;
  expenseId: string;
  budgetPlanId: string;
  amount: number;
  desiredPaidAmount: number;
  paymentSource?: unknown;
  cardDebtId?: string | null;
  debtId?: string | null;
  now?: Date;
  adjustBalances?: boolean;
  resetOnDecrease?: boolean;
}): Promise<{
  finalPaidAmount: number;
  finalPaid: boolean;
  didChangePayments: boolean;
}> {
  const now = params.now ?? new Date();
	const tx = (params.tx ?? prisma) as PaymentSyncDbClient;

  const amount = Math.max(0, Number(params.amount));
  const desired = Math.min(amount, Math.max(0, Number(params.desiredPaidAmount)));

  const expensePayment = getExpensePaymentDelegate(tx);
  if (!expensePayment) {
    const finalPaid = amount > 0 && desired >= amount;
    return { finalPaidAmount: finalPaid ? amount : desired, finalPaid, didChangePayments: false };
  }

  const sumAgg = await expensePayment.aggregate({
    where: { expenseId: params.expenseId },
    _sum: { amount: true },
  });
	const recorded = decimalToNumber((sumAgg as unknown as { _sum?: { amount?: unknown } })._sum?.amount);

  const source = normalizeExpensePaymentSource(params.paymentSource);
  const requestedDebtId = String(params.debtId ?? params.cardDebtId ?? "").trim() || null;

  // Always attribute the payment to the expense's intended pay period.
  // This makes paying an upcoming-period expense slightly early still count
  // for that period in all period-based summaries.
  const expenseRow = await tx.expense.findFirst({
    where: { id: params.expenseId, budgetPlanId: params.budgetPlanId },
    select: { periodKey: true },
  });
  const expensePeriodKey = String(expenseRow?.periodKey ?? "").trim();
  const payDate = expensePeriodKey ? null : await resolvePayDate(params.budgetPlanId);
  const periodKey = expensePeriodKey || getPaymentPeriodKey(now, payDate ?? 1);

  let didChangePayments = false;

  if (recorded > desired && params.resetOnDecrease) {
    await expensePayment.deleteMany({ where: { expenseId: params.expenseId } });
    didChangePayments = true;

    if (desired > 0) {
      await expensePayment.create({
        data: {
          expenseId: params.expenseId,
          amount: desired,
          source,
          paidAt: now,
          periodKey,
        },
      });
    }
  } else if (recorded < desired) {
    const delta = desired - recorded;
    if (delta > 0) {
      const resolvedDebtId = source === "credit_card"
        ? await resolveCreditCardDebtId({
            tx,
            budgetPlanId: params.budgetPlanId,
            requestedDebtId,
          })
        : source === "extra_untracked" && requestedDebtId
          ? await resolveDebtFundingId({
              tx,
              budgetPlanId: params.budgetPlanId,
              requestedDebtId,
              kind: "loan",
            })
          : null;

      await expensePayment.create({
        data: {
          expenseId: params.expenseId,
          amount: delta,
          source,
          debtId: resolvedDebtId ?? undefined,
          paidAt: now,
          periodKey,
        },
      });
      didChangePayments = true;

      if (params.adjustBalances) {
        if (source === "savings") {
          const settings = await getSettings(params.budgetPlanId);
          const current = Number(settings.savingsBalance ?? 0);
          await saveSettings(params.budgetPlanId, { savingsBalance: Math.max(0, current - delta) });
        }

        if (source === "credit_card") {
          if (resolvedDebtId) {
            await applyCreditCardCharge({ tx, budgetPlanId: params.budgetPlanId, debtId: resolvedDebtId, amount: delta });
          }
        }

        if (source === "extra_untracked" && resolvedDebtId) {
          await applyCreditCardCharge({ tx, budgetPlanId: params.budgetPlanId, debtId: resolvedDebtId, amount: delta });
        }

        if (source === "emergency") {
          const settings = await getSettings(params.budgetPlanId);
          const current = Number(settings.emergencyBalance ?? 0);
          await saveSettings(params.budgetPlanId, { emergencyBalance: Math.max(0, current - delta) });
        }

        if (source === "extra_untracked" && requestedDebtId && !resolvedDebtId) {
          const fallbackLoanDebtId = await resolveDebtFundingId({
            tx,
            budgetPlanId: params.budgetPlanId,
            requestedDebtId,
            kind: "loan",
          });
          if (fallbackLoanDebtId) {
            await applyCreditCardCharge({ tx, budgetPlanId: params.budgetPlanId, debtId: fallbackLoanDebtId, amount: delta });
          }
        }
      }
    }
  }

  const finalPaid = amount > 0 && desired >= amount;
  return { finalPaidAmount: finalPaid ? amount : desired, finalPaid, didChangePayments };
}
