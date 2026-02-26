/**
 * POST /api/bff/receipts/scan
 *
 * Accepts a base64 receipt image, runs it through OpenAI Vision, saves a
 * Receipt record as "pending", and returns the parsed data + receiptId so
 * the mobile app can show an editable confirmation screen.
 *
 * Body:
 *   {
 *     image: string        // base64-encoded JPEG (no data-URI prefix)
 *     budgetPlanId?: string
 *   }
 *
 * Response:
 *   {
 *     receiptId: string
 *     merchant: string | null
 *     amount: number | null
 *     currency: string | null
 *     date: string | null        // YYYY-MM-DD
 *     suggestedCategory: string | null
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { parseReceiptImage } from "@/lib/ai/receiptScanner";
import { sanitizeParsedReceipt, validateReceiptImage } from "@/lib/financial-engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { image?: unknown; budgetPlanId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageError = validateReceiptImage(body.image, 5_000_000);
  if (imageError) {
    const isTooLarge = imageError.toLowerCase().includes("too large");
    return NextResponse.json({ error: imageError }, { status: isTooLarge ? 413 : 400 });
  }

  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
  });

  // Fetch user's category names so AI can suggest the best match
  const categoryNames: string[] = [];
  if (budgetPlanId) {
    const cats = await prisma.category.findMany({
      where: { budgetPlanId },
      select: { name: true },
    });
    categoryNames.push(...cats.map((c) => c.name));
  }

  let parsed;
  try {
    parsed = sanitizeParsedReceipt(await parseReceiptImage(body.image as string, categoryNames));
  } catch (err) {
    console.error("[receipts/scan] AI parse error:", err);
    return NextResponse.json(
      { error: "Receipt scanning failed. Please try again or enter details manually." },
      { status: 500 },
    );
  }

  // Persist a pending receipt record for later confirmation
  const receipt = await prisma.receipt.create({
    data: {
      userId,
      budgetPlanId: budgetPlanId ?? undefined,
      merchant: parsed.merchant ?? undefined,
      amount: parsed.amount != null ? String(parsed.amount) : undefined,
      currency: parsed.currency ?? "GBP",
      expenseDate: parsed.date ? new Date(parsed.date) : undefined,
      suggestedCategory: parsed.suggestedCategory ?? undefined,
      rawJson: parsed as object,
      status: "pending",
    },
    select: { id: true },
  });

  return NextResponse.json({
    receiptId: receipt.id,
    merchant: parsed.merchant,
    amount: parsed.amount,
    currency: parsed.currency,
    date: parsed.date,
    suggestedCategory: parsed.suggestedCategory,
  });
}
