import "server-only";

import { prisma } from "@/lib/prisma";
import { getSettings, saveSettings } from "@/lib/settings/store";

export type NormalizedExpensePaymentSource =
  | "income"
  | "savings"
  | "credit_card"
  | "emergency"
  | "extra_untracked";

type PaymentSyncDbClient = {
  expensePayment: typeof prisma.expensePayment;
  debt: typeof prisma.debt;
};

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

async function resolveCreditCardDebtId(params: {
	tx: PaymentSyncDbClient;
  budgetPlanId: string;
  requestedDebtId?: string | null;
}): Promise<string | null> {
  const requested = String(params.requestedDebtId ?? "").trim();

  if (requested) {
    const found = await params.tx.debt.findFirst({
      where: { id: requested, budgetPlanId: params.budgetPlanId, sourceType: null },
      select: { id: true, type: true },
    });
    const t = found ? String((found as unknown as { type?: unknown }).type ?? "") : "";
    if (found && (t === "credit_card" || t === "store_card")) {
      return found.id;
    }
  }

  const cardsAll = await params.tx.debt.findMany({
    where: { budgetPlanId: params.budgetPlanId, sourceType: null },
    select: { id: true, type: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const cards = cardsAll.filter((c) => {
    const t = String((c as unknown as { type?: unknown }).type ?? "");
    return t === "credit_card" || t === "store_card";
  });
  if (cards.length === 1) return cards[0]!.id;
  return null;
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
    select: { id: true, currentBalance: true, initialBalance: true, paidAmount: true },
  });
  if (!card) return;

  const current = decimalToNumber((card as unknown as { currentBalance?: unknown }).currentBalance);
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
        },
      });
    }
  } else if (recorded < desired) {
    const delta = desired - recorded;
    if (delta > 0) {
      await expensePayment.create({
        data: {
          expenseId: params.expenseId,
          amount: delta,
          source,
          paidAt: now,
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
          const debtId = await resolveCreditCardDebtId({
            tx,
            budgetPlanId: params.budgetPlanId,
            requestedDebtId: params.cardDebtId,
          });
          if (debtId) {
            await applyCreditCardCharge({ tx, budgetPlanId: params.budgetPlanId, debtId, amount: delta });
          }
        }
      }
    }
  }

  const finalPaid = amount > 0 && desired >= amount;
  return { finalPaidAmount: finalPaid ? amount : desired, finalPaid, didChangePayments };
}
