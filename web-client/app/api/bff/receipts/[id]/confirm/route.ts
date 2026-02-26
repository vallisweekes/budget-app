/**
 * POST /api/bff/receipts/[id]/confirm
 *
 * Confirms a pending receipt and creates the corresponding Expense record.
 * Run inside a DB transaction so both writes are atomic.
 *
 * Body:
 *   {
 *     name: string           // expense name / merchant (user-edited)
 *     amount: number
 *     month: number          // 1-12
 *     year: number
 *     categoryId?: string
 *     budgetPlanId?: string
 *   }
 *
 * Response:
 *   { success: true, expenseId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { createExpenseFromReceipt, normalizeFundingSource, normalizePaymentSource } from "@/lib/financial-engine";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id: receiptId } = await params;
  if (!receiptId?.trim()) {
    return NextResponse.json({ error: "Receipt ID is required" }, { status: 400 });
  }

  // Verify the receipt belongs to this user and is still pending
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, userId },
    select: { id: true, status: true, budgetPlanId: true },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  if (receipt.status === "confirmed") {
    return NextResponse.json({ error: "Receipt already confirmed" }, { status: 409 });
  }

  let body: {
    name?: unknown;
    amount?: unknown;
    month?: unknown;
    year?: unknown;
    categoryId?: unknown;
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

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : null;
  const amount = Number(body.amount);
  const month  = Number(body.month);
  const year   = Number(body.year);

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  if (!Number.isFinite(month)  || month < 1 || month > 12) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  if (!Number.isFinite(year)   || year < 1900) return NextResponse.json({ error: "Invalid year" }, { status: 400 });

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

  const categoryId =
    typeof body.categoryId === "string" && body.categoryId.trim()
      ? body.categoryId.trim()
      : undefined;
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
    if (message === "Invalid month" || message === "Invalid year" || message === "Name is required" || message === "Amount must be > 0") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Expense creation failed" }, { status: 500 });
  }
}
