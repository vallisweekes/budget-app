import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const debts = await prisma.debt.findMany({
      include: {
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(debts);
  } catch (error) {
    console.error("Failed to fetch debts:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const debt = await prisma.debt.create({
      data: {
        name: body.name,
        type: body.type,
        initialBalance: body.initialBalance,
        currentBalance: body.currentBalance || body.initialBalance,
        amount: body.amount,
        paid: body.paid || false,
        paidAmount: body.paidAmount || 0,
        monthlyMinimum: body.monthlyMinimum || null,
        sourceType: body.sourceType || null,
        sourceExpenseId: body.sourceExpenseId || null,
        sourceMonthKey: body.sourceMonthKey || null,
        sourceCategoryId: body.sourceCategoryId || null,
        sourceCategoryName: body.sourceCategoryName || null,
        sourceExpenseName: body.sourceExpenseName || null,
      },
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Failed to create debt:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}
