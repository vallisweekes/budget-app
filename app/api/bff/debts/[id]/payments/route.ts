import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payments = await prisma.debtPayment.findMany({
      where: { debtId: id },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Create payment
    const payment = await prisma.debtPayment.create({
      data: {
        debtId: id,
        amount: body.amount,
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
        notes: body.notes || null,
      },
    });

    // Update debt balance
    const debt = await prisma.debt.findUnique({ where: { id } });
    if (debt) {
      await prisma.debt.update({
        where: { id },
        data: {
          currentBalance: debt.currentBalance.toNumber() - body.amount,
          paidAmount: debt.paidAmount.toNumber() + body.amount,
        },
      });
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
