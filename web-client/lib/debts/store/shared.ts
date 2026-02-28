import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RuntimeField = { name?: string };
type RuntimeModel = { fields?: RuntimeField[] };
type RuntimeDataModel = { models?: Record<string, RuntimeModel | undefined> };
type PrismaWithRuntime = typeof prisma & { _runtimeDataModel?: RuntimeDataModel };

function prismaDebtHasField(fieldName: string): boolean {
	try {
		const runtime = prisma as PrismaWithRuntime;
		const fields = runtime._runtimeDataModel?.models?.Debt?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((field) => field?.name === fieldName);
	} catch {
		return false;
	}
}

function prismaDebtPaymentHasField(fieldName: string): boolean {
	try {
		const runtime = prisma as PrismaWithRuntime;
		const fields = runtime._runtimeDataModel?.models?.DebtPayment?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((field) => field?.name === fieldName);
	} catch {
		return false;
	}
}

export const DEBT_HAS_CREDIT_LIMIT = prismaDebtHasField("creditLimit");
export const DEBT_HAS_DUE_DAY = prismaDebtHasField("dueDay");
export const DEBT_HAS_DUE_DATE = prismaDebtHasField("dueDate");
export const DEBT_HAS_LOGO_URL = prismaDebtHasField("logoUrl");
export const DEBT_HAS_DEFAULT_PAYMENT_SOURCE = prismaDebtHasField("defaultPaymentSource");
export const DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID = prismaDebtHasField("defaultPaymentCardDebtId");
export const DEBT_PAYMENT_HAS_CARD_DEBT_ID = prismaDebtPaymentHasField("cardDebtId");

export function debtSelect(): Prisma.DebtSelect {
	return {
		id: true,
		name: true,
		type: true,
		...(DEBT_HAS_LOGO_URL ? { logoUrl: true } : {}),
		...(DEBT_HAS_CREDIT_LIMIT ? { creditLimit: true } : {}),
		...(DEBT_HAS_DUE_DAY ? { dueDay: true } : {}),
		...(DEBT_HAS_DUE_DATE ? { dueDate: true } : {}),
		initialBalance: true,
		currentBalance: true,
		amount: true,
		paid: true,
		paidAmount: true,
		...(DEBT_HAS_DEFAULT_PAYMENT_SOURCE ? { defaultPaymentSource: true } : {}),
		...(DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID ? { defaultPaymentCardDebtId: true } : {}),
		monthlyMinimum: true,
		interestRate: true,
		installmentMonths: true,
		createdAt: true,
		sourceType: true,
		sourceExpenseId: true,
		sourceMonthKey: true,
		sourceCategoryId: true,
		sourceCategoryName: true,
		sourceExpenseName: true,
	} as Prisma.DebtSelect;
}

export function paymentSelect(): Prisma.DebtPaymentSelect {
	return {
		id: true,
		debtId: true,
		amount: true,
		paidAt: true,
		source: true,
		...(DEBT_PAYMENT_HAS_CARD_DEBT_ID ? { cardDebtId: true } : {}),
	} as Prisma.DebtPaymentSelect;
}

export function decimalToNumber(value: unknown): number {
	if (value == null) return 0;
	if (typeof value === "number") return value;
	if (typeof value === "object" && "toString" in value) {
		const stringer = value as { toString: () => string };
		return Number(stringer.toString());
	}
	return Number(value);
}

export function paymentMonthKeyFromDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

export function parseYearMonthKey(value: string | undefined): { year: number; month: number } | null {
	const raw = String(value ?? "").trim();
	const match = raw.match(/^([0-9]{4})-([0-9]{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
	return { year, month };
}
