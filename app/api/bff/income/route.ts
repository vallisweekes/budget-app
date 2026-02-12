import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const where: any = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const income = await prisma.income.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to fetch income:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const income = await prisma.income.create({
      data: {
        name: body.name,
        amount: body.amount,
        month: body.month,
        year: body.year,
      },
    });

    return NextResponse.json(income, { status: 201 });
  } catch (error) {
    console.error("Failed to create income:", error);
    return NextResponse.json(
      { error: "Failed to create income" },
      { status: 500 }
    );
  }
}
