import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { parseReceiptImage } from "@/lib/ai/receiptScanner";
import { sanitizeParsedReceipt, validateReceiptImage } from "@/lib/financial-engine";

export const runtime = "nodejs";

/**
 * POST /api/scan-receipt
 *
 * Public alias endpoint for all clients (mobile/web/PWA).
 * Accepts either `imageBase64` or `image` in the request body.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { imageBase64?: unknown; image?: unknown; budgetPlanId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageBase64 =
    typeof body.imageBase64 === "string" && body.imageBase64.trim()
      ? body.imageBase64
      : typeof body.image === "string"
        ? body.image
        : null;

  const imageError = validateReceiptImage(imageBase64, 5_000_000);
  if (imageError) {
    const isTooLarge = imageError.toLowerCase().includes("too large");
    return NextResponse.json({ error: imageError }, { status: isTooLarge ? 413 : 400 });
  }

  const budgetPlanId = await resolveOwnedBudgetPlanId({
    userId,
    budgetPlanId: typeof body.budgetPlanId === "string" ? body.budgetPlanId : null,
  });

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
    parsed = sanitizeParsedReceipt(await parseReceiptImage(imageBase64 as string, categoryNames));
  } catch (error) {
    console.error("[scan-receipt] AI parse error:", error);
    return NextResponse.json(
      { error: "Receipt scanning failed. Please try again or enter details manually." },
      { status: 500 },
    );
  }

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
