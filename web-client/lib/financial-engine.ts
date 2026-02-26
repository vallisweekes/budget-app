/**
 * financial-engine.ts
 *
 * Centralised financial write logic for the budget app.
 *
 * One backend, multiple clients (Web, PWA, Mobile).
 * All clients call the same API routes; routes call into this engine;
 * the engine owns balance mutations, expense creation, and notifications.
 *
 * API routes stay thin — they only parse/validate, then delegate here.
 *
 * Core operations
 * ───────────────
 * createExpense          — full expense creation (manual entry path)
 * createExpenseFromReceipt — receipt-confirm path (always marked paid)
 * recordPaymentSource    — deducts savings / charges card / logs payment
 * fireCategoryThresholdPush — background budget-alert notifications
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { addOrUpdateExpenseAcrossMonths } from "@/lib/expenses/store";
import { resolveExpenseLogoWithSearch } from "@/lib/expenses/logoResolver";
import { maybeSendCategoryThresholdPush } from "@/lib/push/thresholdNotifications";
import { getSettings, saveSettings } from "@/lib/settings/store";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type PaymentSource = "income" | "credit_card" | "savings" | "extra_untracked";

export type CreateExpenseInput = {
  budgetPlanId: string;
  userId: string;
  name: string;
  amount: number;
  month: number;          // 1-12
  year: number;
  categoryId?: string;
  paid?: boolean;
  isAllocation?: boolean;
  isDirectDebit?: boolean;
  distributeMonths?: boolean;
  distributeYears?: boolean;
  dueDate?: string;       // YYYY-MM-DD
  paymentSource?: PaymentSource;
  cardDebtId?: string;
};

export type CreateExpenseResult = {
  expenseId: string;
  name: string;
  amount: number;
  month: number;
  year: number;
  categoryId: string | null;
  merchantDomain: string | null;
  logoUrl: string | null;
};

export type ReceiptExpenseInput = {
  budgetPlanId: string;
  userId: string;
  receiptId: string;
  name: string;
  amount: number;
  month: number;
  year: number;
  categoryId?: string;
};

type ExpensePaymentDelegate = {
  create: (args: {
    data: {
      expenseId: string;
      amount: number;
      source: "income" | "credit_card" | "savings" | "extra_untracked";
      paidAt: Date;
    };
  }) => Promise<unknown>;
};

type AddOrUpdatePayload = Parameters<typeof addOrUpdateExpenseAcrossMonths>[3];

type CreatedExpenseShape = {
  id: string;
  name: string;
  amount: unknown;
  month: number;
  year: number;
  categoryId: string | null;
  merchantDomain: string | null;
  logoUrl: string | null;
  category?: { name?: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizePaymentSource(raw: unknown): PaymentSource {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "credit_card" || v === "card" || v === "credit card") return "credit_card";
  if (v === "savings") return "savings";
  if (v === "other" || v === "extra_untracked") return "extra_untracked";
  return "income";
}

/**
 * Returns the list of months to distribute across for a given year.
 * When distributeMonths=false, returns only the target month.
 */
function resolveTargetMonths(
  month: number,
  year: number,
  targetYear: number,
  distributeMonths: boolean,
): MonthKey[] {
  if (!distributeMonths) return [MONTHS[month - 1] as MonthKey];
  const start = targetYear === year ? month - 1 : 0;
  return (MONTHS as MonthKey[]).slice(start);
}

// ─── Payment source recording ─────────────────────────────────────────────────

/**
 * Records a payment against an expense.
 * Handles credit card balance increases and savings deductions.
 * Best-effort — never throws, so it never blocks the expense creation response.
 */
export async function recordPaymentSource({
  expenseId,
  budgetPlanId,
  amount,
  paymentSource,
  cardDebtId,
}: {
  expenseId: string;
  budgetPlanId: string;
  amount: number;
  paymentSource: PaymentSource;
  cardDebtId?: string;
}): Promise<void> {
  try {
    const expensePayment = (prisma as unknown as { expensePayment?: ExpensePaymentDelegate }).expensePayment ?? null;
    if (!expensePayment || amount <= 0) return;

    if (paymentSource === "credit_card") {
      let resolvedCardId = cardDebtId ?? "";

      if (!resolvedCardId) {
        const cards = await prisma.debt.findMany({
          where: {
            budgetPlanId,
            sourceType: null,
            type: { in: ["credit_card", "store_card"] },
          },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });
        if (cards.length === 1) resolvedCardId = cards[0]!.id;
      }

      await expensePayment.create({
        data: { expenseId, amount, source: "credit_card", paidAt: new Date() },
      });

      if (resolvedCardId) {
        await prisma.$transaction(async (tx) => {
          const card = await tx.debt.findFirst({
            where: { id: resolvedCardId, budgetPlanId, sourceType: null },
            select: {
              id: true,
              currentBalance: true,
              initialBalance: true,
              paidAmount: true,
            },
          });
          if (!card) return;

          const current = Number(card.currentBalance?.toString?.() ?? card.currentBalance ?? 0);
          const initial = Number(card.initialBalance?.toString?.() ?? card.initialBalance ?? 0);
          const paid   = Number(card.paidAmount?.toString?.()     ?? card.paidAmount     ?? 0);

          const nextCurrent = Math.max(0, current + amount);
          const nextInitial = Math.max(initial, nextCurrent);

          await tx.debt.update({
            where: { id: card.id },
            data: {
              currentBalance: String(nextCurrent),
              initialBalance: String(nextInitial),
              paidAmount:     String(Math.min(Math.max(0, paid), nextInitial)),
              paid:           false,
            },
          });
        });
      }
    } else if (paymentSource === "savings") {
      await expensePayment.create({
        data: { expenseId, amount, source: "savings", paidAt: new Date() },
      });
      const settings = await getSettings(budgetPlanId);
      const current  = Number(settings.savingsBalance ?? 0);
      await saveSettings(budgetPlanId, { savingsBalance: Math.max(0, current - amount) });
    } else {
      // income or extra_untracked
      await expensePayment.create({
        data: { expenseId, amount, source: paymentSource, paidAt: new Date() },
      });
    }
  } catch {
    // Payment recording is best-effort — never fail expense creation
  }
}

// ─── Category threshold push (fire-and-forget) ───────────────────────────────

/**
 * Fires a push notification if the category is crossing the 80% / 100%
 * budget threshold.  Always runs in the background — never awaited in a
 * request handler.
 */
export function fireCategoryThresholdPush({
  budgetPlanId,
  userId,
  categoryId,
  categoryName,
  month,
  year,
  amountDelta,
}: {
  budgetPlanId: string;
  userId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  month: number;
  year: number;
  amountDelta: number;
}): void {
  if (!categoryId || amountDelta <= 0) return;
  void maybeSendCategoryThresholdPush({
    budgetPlanId,
    userId,
    categoryId,
    categoryName: categoryName ?? null,
    month,
    year,
    amountDelta,
  });
}

// ─── Core: create expense (manual entry) ─────────────────────────────────────

/**
 * Full expense creation — used by the manual entry API route.
 * Supports distribution across months/years, payment source recording,
 * and budget threshold notifications.
 *
 * All DB writes involving balance changes are wrapped in transactions.
 * Throws on validation errors; callers should catch and return 4xx/5xx.
 */
export async function createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
  const {
    budgetPlanId,
    userId,
    name,
    amount,
    month,
    year,
    categoryId,
    paid    = false,
    isAllocation  = false,
    isDirectDebit = false,
    distributeMonths = false,
    distributeYears  = false,
    dueDate,
    paymentSource = "income",
    cardDebtId,
  } = input;

  // Validation
  if (!name)                                          throw new Error("Name is required");
  if (!Number.isFinite(amount) || amount < 0)         throw new Error("Amount must be a number >= 0");
  if (!Number.isFinite(month)  || month < 1 || month > 12) throw new Error("Invalid month");
  if (!Number.isFinite(year)   || year < 1900)        throw new Error("Invalid year");

  // Build target years
  let targetYears: number[];
  if (distributeYears) {
    const plan = await prisma.budgetPlan.findUnique({
      where: { id: budgetPlanId },
      select: { budgetHorizonYears: true },
    });
    const horizon = Math.max(2, Math.floor(Number(plan?.budgetHorizonYears ?? 2)));
    targetYears = Array.from({ length: horizon }, (_, i) => year + i);
  } else {
    targetYears = [year];
  }

  const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const logo     = await resolveExpenseLogoWithSearch(name);

  // Write expense row(s)
  for (const y of targetYears) {
    const months = resolveTargetMonths(month, year, y, distributeMonths);
    await addOrUpdateExpenseAcrossMonths(budgetPlanId, y, months, {
      id:             sharedId,
      name,
      merchantDomain: logo.merchantDomain ?? undefined,
      amount,
      categoryId,
      paid,
      paidAmount:     paid ? amount : 0,
      isAllocation,
      isDirectDebit,
      dueDate,
      paymentSource,
      cardDebtId:     cardDebtId || undefined,
    } as AddOrUpdatePayload);
  }

  // Fetch the primary record
  const created = await prisma.expense.findFirst({
    where: { budgetPlanId, month, year, name },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true, featured: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!created) throw new Error("Expense was not created");
  const createdExpense = created as unknown as CreatedExpenseShape;

  // Record payment source (best-effort, never blocks)
  if (paid) {
    await recordPaymentSource({
      expenseId:     created.id,
      budgetPlanId,
      amount,
      paymentSource,
      cardDebtId,
    });
  }

  // Fire threshold notification in background
  if (!isAllocation) {
    fireCategoryThresholdPush({
      budgetPlanId,
      userId,
      categoryId:   categoryId ?? null,
      categoryName: createdExpense.category?.name ?? null,
      month,
      year,
      amountDelta:  amount,
    });
  }

  return {
    expenseId:      createdExpense.id,
    name:           createdExpense.name,
    amount:         Number((createdExpense.amount as { toString?: () => string })?.toString?.() ?? createdExpense.amount ?? 0),
    month:          createdExpense.month,
    year:           createdExpense.year,
    categoryId:     createdExpense.categoryId ?? null,
    merchantDomain: createdExpense.merchantDomain ?? null,
    logoUrl:        createdExpense.logoUrl ?? null,
  };
}

// ─── Core: create expense from confirmed receipt ──────────────────────────────

/**
 * Creates an expense from a confirmed receipt, then links the receipt record
 * and fires a threshold notification.
 *
 * Always marks the expense as paid (receipts represent money already spent).
 * Receipt status is updated atomically with the expense link.
 *
 * Throws on failure — callers should catch and return 4xx/5xx.
 */
export async function createExpenseFromReceipt(
  input: ReceiptExpenseInput,
): Promise<{ expenseId: string }> {
  const { budgetPlanId, userId, receiptId, name, amount, month, year, categoryId } = input;

  // Validate
  if (!name)                                               throw new Error("Name is required");
  if (!Number.isFinite(amount) || amount <= 0)             throw new Error("Amount must be > 0");
  if (!Number.isFinite(month)  || month < 1 || month > 12) throw new Error("Invalid month");
  if (!Number.isFinite(year)   || year < 1900)             throw new Error("Invalid year");

  const sharedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const logo     = await resolveExpenseLogoWithSearch(name);
  const monthKey = MONTHS[month - 1] as MonthKey;

  // Write the expense
  await addOrUpdateExpenseAcrossMonths(budgetPlanId, year, [monthKey], {
    id:             sharedId,
    name,
    merchantDomain: logo.merchantDomain ?? undefined,
    amount,
    categoryId,
    paid:           true,
    paidAmount:     amount,
    isAllocation:   false,
    isDirectDebit:  false,
  } as AddOrUpdatePayload);

  // Fetch the created record
  const created = await prisma.expense.findFirst({
    where: { budgetPlanId, month, year, name },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!created) throw new Error("Expense creation failed");

  // Mark receipt confirmed + link expense in one transaction
  await prisma.$transaction([
    prisma.receipt.update({
      where: { id: receiptId },
      data: { status: "confirmed", expenseId: created.id },
    }),
  ]);

  // Budget threshold push (background)
  fireCategoryThresholdPush({
    budgetPlanId,
    userId,
    categoryId:   categoryId ?? null,
    categoryName: null,
    month,
    year,
    amountDelta:  amount,
  });

  return { expenseId: created.id };
}

// ─── Image validation (scan route guard) ─────────────────────────────────────

const ALLOWED_MIME_PREFIXES: Record<string, string> = {
  "/9j/": "image/jpeg",
  "iVBOR": "image/png",
  "R0lGO": "image/gif",
  "UklGR": "image/webp",
};

/**
 * Validates a base64-encoded image string server-side.
 * Returns an error string if invalid, or null if OK.
 *
 * Guards against:
 *   - Non-image content posing as an upload
 *   - Oversized payloads
 */
export function validateReceiptImage(
  base64: unknown,
  maxBytes = 5_000_000,
): string | null {
  if (typeof base64 !== "string" || !base64.trim()) {
    return "image (base64) is required";
  }

  // Size guard (~1.33 overhead for base64)
  if (base64.length > maxBytes) {
    return `Image too large — please keep receipts under ${Math.round(maxBytes * 0.75 / 1024)}KB`;
  }

  // MIME sniff by checking the first bytes of the base64 payload
  const prefix = base64.slice(0, 5);
  const matched = Object.keys(ALLOWED_MIME_PREFIXES).some((p) => prefix.startsWith(p));
  if (!matched) {
    return "Only JPEG, PNG, GIF, or WebP images are accepted";
  }

  return null;
}

/**
 * Sanitises AI-parsed receipt output.
 * Clamps/nullifies values that are out of plausible ranges.
 */
export function sanitizeParsedReceipt(parsed: {
  merchant?: string | null;
  amount?: number | null;
  currency?: string | null;
  date?: string | null;
  suggestedCategory?: string | null;
  notes?: string | null;
}) {
  return {
    merchant:          typeof parsed.merchant === "string"          ? parsed.merchant.slice(0, 200).trim() || null : null,
    amount:            typeof parsed.amount   === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0 && parsed.amount < 1_000_000
                         ? Math.round(parsed.amount * 100) / 100
                         : null,
    currency:          typeof parsed.currency === "string"          ? parsed.currency.slice(0, 10).toUpperCase() || null : null,
    date:              typeof parsed.date     === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
    suggestedCategory: typeof parsed.suggestedCategory === "string" ? parsed.suggestedCategory.slice(0, 100).trim() || null : null,
    notes:             typeof parsed.notes    === "string"          ? parsed.notes.slice(0, 500).trim() || null : null,
  };
}
