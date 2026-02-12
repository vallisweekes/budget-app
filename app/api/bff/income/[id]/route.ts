import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const income = await prisma.income.findUnique({
      where: { id },
    });

    if (!income) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
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

    const income = await prisma.income.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to update income:", error);
    return NextResponse.json(
      { error: "Failed to update income" },
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
    await prisma.income.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete income:", error);
    return NextResponse.json(
      { error: "Failed to delete income" },
      { status: 500 }
    );
  }
}
