import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function decimalToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof (value as { toString: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "0";
}

function serializeExpense(expense: {
  id: string;
  name: string;
  amount: unknown;
  paid: boolean;
  paidAmount: unknown;
  month: number;
  year: number;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    featured: boolean;
  } | null;
}) {
  return {
    id: expense.id,
    name: expense.name,
    amount: decimalToString(expense.amount),
    paid: expense.paid,
    paidAmount: decimalToString(expense.paidAmount),
    month: expense.month,
    year: expense.year,
    categoryId: expense.categoryId,
    category: expense.category ?? null,
  };
}

type PatchBody = {
  name?: unknown;
  amount?: unknown;
  categoryId?: unknown;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") return badRequest("Invalid JSON body");
  const body = raw as PatchBody;

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const amount = body.amount == null ? undefined : Number(body.amount);
  const categoryId =
    body.categoryId == null
      ? undefined
      : typeof body.categoryId === "string"
        ? body.categoryId.trim() || null
        : undefined;

  if (name !== undefined && !name) return badRequest("Name cannot be empty");
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
    return badRequest("Amount must be a number >= 0");
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      amount: true,
      paid: true,
      paidAmount: true,
      categoryId: true,
      budgetPlan: { select: { userId: true } },
    },
  });
  if (!existing || existing.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextName = name ?? existing.name;
  const nextAmountNumber = amount ?? Number(existing.amount.toString());

  // Preserve payment intent: if it was fully paid, keep it fully paid after amount edits.
  const existingPaidAmountNumber = Number(existing.paidAmount.toString());
  let nextPaidAmountNumber = existingPaidAmountNumber;

  if (existing.paid) {
    nextPaidAmountNumber = nextAmountNumber;
  } else {
    nextPaidAmountNumber = Math.min(existingPaidAmountNumber, nextAmountNumber);
  }

  const nextPaid = nextAmountNumber > 0 && nextPaidAmountNumber >= nextAmountNumber;
  if (nextPaid) nextPaidAmountNumber = nextAmountNumber;

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      name: nextName,
      amount: String(nextAmountNumber),
      paid: nextPaid,
      paidAmount: String(nextPaidAmountNumber),
      categoryId: categoryId === undefined ? existing.categoryId : categoryId,
    },
    include: {
      category: {
        select: { id: true, name: true, icon: true, color: true, featured: true },
      },
    },
  });

  return NextResponse.json(serializeExpense(updated));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

	const existing = await prisma.expense.findUnique({
		where: { id },
		select: { id: true, budgetPlan: { select: { userId: true } } },
	});
	if (!existing || existing.budgetPlan.userId !== userId) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

  await prisma.expense.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true as const });
}
