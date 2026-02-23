import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId, resolveOwnedBudgetPlanId } from "@/lib/api/bffAuth";
import { prisma } from "@/lib/prisma";
import { getDebtById } from "@/lib/debts/store";
import { getDebtMonthlyPayment } from "@/lib/debts/calculate";

export const runtime = "nodejs";

function unauthorized() {
	return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number(value);
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "object") {
		const maybe = value as { toString?: () => string };
		if (typeof maybe.toString === "function") return Number(maybe.toString());
	}
	return Number(value);
}

function normalizeKind(value: string | null): "expense" | "debt" | null {
	const raw = String(value ?? "").trim().toLowerCase();
	if (raw === "expense") return "expense";
	if (raw === "debt") return "debt";
	return null;
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 86_400_000);
}

/**
 * GET /api/bff/payment-detail?budgetPlanId=<optional>&kind=expense|debt&id=<id>
 *
 * Returns details for one payment item to show in a mobile sheet:
 * - amount due now
 * - when it's due
 * - payment history
 * - basic overdue/missed flags
 */
export async function GET(req: NextRequest) {
	try {
		const userId = await getSessionUserId();
		if (!userId) return unauthorized();

		const { searchParams } = new URL(req.url);
		const kind = normalizeKind(searchParams.get("kind"));
		const id = String(searchParams.get("id") ?? "").trim();

		if (!kind) return badRequest("Missing or invalid kind");
		if (!id) return badRequest("Missing id");

		const budgetPlanId = await resolveOwnedBudgetPlanId({
			userId,
			budgetPlanId: searchParams.get("budgetPlanId"),
		});
		if (!budgetPlanId) {
			return NextResponse.json({ error: "Budget plan not found" }, { status: 404 });
		}

		const now = new Date();

		if (kind === "expense") {
			const expense = await prisma.expense.findFirst({
				where: { id, budgetPlanId },
				select: {
					id: true,
					name: true,
					amount: true,
					paidAmount: true,
					paid: true,
					dueDate: true,
					month: true,
					year: true,
					isAllocation: true,
				},
			});
			if (!expense || expense.isAllocation) {
				return NextResponse.json({ error: "Expense not found" }, { status: 404 });
			}

			const amount = decimalToNumber(expense.amount);
			const paidAmount = decimalToNumber(expense.paidAmount);
			const dueAmount = Math.max(0, amount - paidAmount);
			const dueDateIso = expense.dueDate ? expense.dueDate.toISOString() : null;

			const payments = await prisma.expensePayment.findMany({
				where: { expenseId: expense.id },
				orderBy: [{ paidAt: "desc" }],
				take: 25,
				select: {
					id: true,
					amount: true,
					paidAt: true,
					source: true,
					debtId: true,
				},
			});

			const overdue = !!expense.dueDate && dueAmount > 0 && expense.dueDate.getTime() < now.getTime();
			const missed = !!expense.dueDate && dueAmount > 0 && addDays(expense.dueDate, 5).getTime() < now.getTime();

			return NextResponse.json({
				kind,
				budgetPlanId,
				id: expense.id,
				name: expense.name,
				dueAmount,
				dueDate: dueDateIso,
				dueDay: null,
				overdue,
				missed,
				payments: payments.map((p) => ({
					id: p.id,
					amount: decimalToNumber(p.amount),
					date: p.paidAt.toISOString(),
					source: String(p.source),
				})),
			});
		}

		// kind === "debt"
		const debt = await getDebtById(budgetPlanId, id);
		if (!debt) {
			return NextResponse.json({ error: "Debt not found" }, { status: 404 });
		}

		const dueAmount = getDebtMonthlyPayment(debt);
		const dueDate = debt.dueDate ? new Date(debt.dueDate) : null;
		const overdue = !!dueDate && dueAmount > 0 && dueDate.getTime() < now.getTime();
		const missed = !!dueDate && dueAmount > 0 && addDays(dueDate, 5).getTime() < now.getTime();

		const payments = await prisma.debtPayment.findMany({
			where: { debtId: debt.id },
			orderBy: [{ paidAt: "desc" }],
			take: 25,
			select: {
				id: true,
				amount: true,
				paidAt: true,
				source: true,
				cardDebtId: true,
			},
		});

		return NextResponse.json({
			kind,
			budgetPlanId,
			id: debt.id,
			name: debt.sourceType === "expense" ? String(debt.sourceExpenseName ?? debt.name) : debt.name,
			dueAmount,
			dueDate: dueDate ? dueDate.toISOString() : null,
			dueDay: debt.dueDay ?? null,
			overdue,
			missed,
			payments: payments.map((p) => ({
				id: p.id,
				amount: decimalToNumber(p.amount),
				date: p.paidAt.toISOString(),
				source: String(p.source),
			})),
		});
	} catch (error) {
		console.error("Failed to compute payment detail:", error);
		const isProd = process.env.NODE_ENV === "production";
		const detail = error instanceof Error ? error.message : String(error);
		return NextResponse.json(
			{
				error: "Failed to compute payment detail",
				...(isProd ? {} : { detail }),
			},
			{ status: 500 }
		);
	}
}
