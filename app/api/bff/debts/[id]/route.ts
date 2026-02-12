import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!debt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    return NextResponse.json(debt);
  } catch (error) {
    console.error("Failed to fetch debt:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const debt = await prisma.debt.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(debt);
  } catch (error) {
    console.error("Failed to update debt:", error);
    return NextResponse.json(
      { error: "Failed to update debt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.debt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete debt:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 }
    );
  }
}
