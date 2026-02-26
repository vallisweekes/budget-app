import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createExpenseFromReceipt, normalizeFundingSource, normalizePaymentSource } from "@/lib/financial-engine";

export const runtime = "nodejs";

/**
 * POST /api/confirm-expense
 *
 * Public alias endpoint for all clients (mobile/web/PWA).
 * Accepts receipt confirmation payload and creates the expense through
 * the shared financial engine.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    receiptId?: unknown;
    incomeSourceId?: unknown;
    merchant?: unknown;
    name?: unknown;
    amount?: unknown;
    category?: unknown;
    categoryId?: unknown;
    expenseDate?: unknown;
    month?: unknown;
    year?: unknown;
    budgetPlanId?: unknown;
    paymentSource?: unknown;
    fundingSource?: unknown;
    cardDebtId?: unknown;
    debtId?: unknown;
    newLoanName?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const receiptId = typeof body.receiptId === "string" ? body.receiptId.trim() : "";
  if (!receiptId) return NextResponse.json({ error: "receiptId is required" }, { status: 400 });

  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, userId },
    select: { id: true, status: true, budgetPlanId: true },
  });

  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  if (receipt.status === "confirmed") {
    return NextResponse.json({ error: "Receipt already confirmed" }, { status: 409 });
  }

  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId:
      typeof body.budgetPlanId === "string"
        ? body.budgetPlanId
        : receipt.budgetPlanId ?? null,
  });

  if (!budgetPlanId) {
    return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
  }

  const name =
    typeof body.merchant === "string" && body.merchant.trim()
      ? body.merchant.trim()
      : typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "";

  const amount = Number(body.amount);

  let month = Number(body.month);
  let year = Number(body.year);

  if (typeof body.expenseDate === "string" && body.expenseDate.trim()) {
    const d = new Date(body.expenseDate);
    if (!Number.isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }
  }

  let categoryId =
    typeof body.categoryId === "string" && body.categoryId.trim()
      ? body.categoryId.trim()
      : undefined;

  if (!categoryId && typeof body.category === "string" && body.category.trim()) {
    const categoryName = body.category.trim();
    const matched = await prisma.category.findFirst({
      where: {
        budgetPlanId,
        name: { equals: categoryName, mode: "insensitive" },
      },
      select: { id: true },
    });
    categoryId = matched?.id;
  }

  const paymentSource = normalizePaymentSource(body.paymentSource);
  const fundingSource = normalizeFundingSource(body.fundingSource ?? body.paymentSource);
  const cardDebtId = typeof body.cardDebtId === "string" && body.cardDebtId.trim() ? body.cardDebtId.trim() : undefined;
  const debtId = typeof body.debtId === "string" && body.debtId.trim() ? body.debtId.trim() : undefined;
  const newLoanName = typeof body.newLoanName === "string" && body.newLoanName.trim() ? body.newLoanName.trim() : undefined;

  try {
    const result = await createExpenseFromReceipt({
      budgetPlanId,
      userId,
      receiptId,
      name,
      amount,
      month,
      year,
      categoryId,
      paymentSource,
      fundingSource,
      cardDebtId,
      debtId,
      newLoanName,
    });

    return NextResponse.json({ success: true, expenseId: result.expenseId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expense creation failed";
    if (
      message === "Invalid month" ||
      message === "Invalid year" ||
      message === "Name is required" ||
      message === "Amount must be > 0"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Expense creation failed" }, { status: 500 });
  }
}
