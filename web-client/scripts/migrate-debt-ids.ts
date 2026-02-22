import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

function prismaDebtHasField(fieldName: string): boolean {
	try {
		const fields = (prisma as any)?._runtimeDataModel?.models?.Debt?.fields;
		if (!Array.isArray(fields)) return false;
		return fields.some((f: any) => f?.name === fieldName);
	} catch {
		return false;
	}
}

const DEBT_HAS_CREDIT_LIMIT = prismaDebtHasField("creditLimit");
const DEBT_HAS_DUE_DAY = prismaDebtHasField("dueDay");
const DEBT_HAS_DUE_DATE = prismaDebtHasField("dueDate");
const DEBT_HAS_LAST_ACCRUAL_MONTH = prismaDebtHasField("lastAccrualMonth");
const DEBT_HAS_DEFAULT_PAYMENT_SOURCE = prismaDebtHasField("defaultPaymentSource");
const DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID = prismaDebtHasField("defaultPaymentCardDebtId");
const DEBT_HAS_INTEREST_RATE = prismaDebtHasField("interestRate");
const DEBT_HAS_INSTALLMENT_MONTHS = prismaDebtHasField("installmentMonths");

function hasFlag(flag: string): boolean {
	return process.argv.includes(flag);
}

function getArgValue(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function deepReplaceStrings(value: JsonValue, mapping: Record<string, string>): JsonValue {
	if (typeof value === "string") {
		return mapping[value] ?? value;
	}
	if (Array.isArray(value)) {
		return value.map((v) => deepReplaceStrings(v, mapping));
	}
	if (value && typeof value === "object") {
		const out: Record<string, JsonValue> = {};
		for (const [k, v] of Object.entries(value)) out[k] = deepReplaceStrings(v, mapping);
		return out;
	}
	return value;
}

async function listMatchingFiles(rootDir: string): Promise<string[]> {
	const out: string[] = [];
	const queue: string[] = [rootDir];

	while (queue.length) {
		const dir = queue.pop()!;
		let entries: Dirent[];
		try {
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				queue.push(full);
				continue;
			}
			if (entry.isFile()) {
				if (entry.name === "debts.json" || entry.name === "debt-payments.json") out.push(full);
			}
		}
	}

	return out.sort();
}

async function updateJsonFiles(mapping: Record<string, string>) {
	const dataRoot = path.join(process.cwd(), "data");
	const files = await listMatchingFiles(dataRoot);
	if (!files.length) {
		console.log("No matching JSON files found under data/.");
		return;
	}

	let changedCount = 0;
	for (const filePath of files) {
		let raw: string;
		try {
			raw = await fs.readFile(filePath, "utf-8");
		} catch {
			continue;
		}

		let parsed: JsonValue;
		try {
			parsed = JSON.parse(raw) as JsonValue;
		} catch {
			continue;
		}

		const replaced = deepReplaceStrings(parsed, mapping);
		const next = JSON.stringify(replaced, null, 2) + "\n";
		if (next !== raw) {
			await fs.writeFile(filePath, next);
			changedCount++;
			console.log(`✓ Updated ${path.relative(process.cwd(), filePath)}`);
		}
	}

	if (!changedCount) console.log("No JSON files required updates.");
}

async function main() {
	const apply = hasFlag("--apply");
	const updateSeedFiles = hasFlag("--update-seed-files");
	const budgetPlanId = getArgValue("--plan");

	type DebtRow = {
		id: string;
		name: string;
		type: string;
		budgetPlanId: string;
		initialBalance: unknown;
		currentBalance: unknown;
		amount: unknown;
		paid: boolean;
		paidAmount: unknown;
		createdAt: Date;
		creditLimit?: unknown | null;
		dueDay?: number | null;
		dueDate?: Date | null;
		lastAccrualMonth?: string | null;
		defaultPaymentSource?: unknown | null;
		defaultPaymentCardDebtId?: string | null;
		monthlyMinimum?: unknown | null;
		interestRate?: unknown | null;
		installmentMonths?: number | null;
		sourceType?: string | null;
		sourceExpenseId?: string | null;
		sourceMonthKey?: string | null;
		sourceCategoryId?: string | null;
		sourceCategoryName?: string | null;
		sourceExpenseName?: string | null;
	};

	const select: any = {
		id: true,
		name: true,
		type: true,
		initialBalance: true,
		currentBalance: true,
		amount: true,
		paid: true,
		paidAmount: true,
		monthlyMinimum: true,
		budgetPlanId: true,
		sourceType: true,
		sourceExpenseId: true,
		sourceMonthKey: true,
		sourceCategoryId: true,
		sourceCategoryName: true,
		sourceExpenseName: true,
		createdAt: true,
	};
	if (DEBT_HAS_CREDIT_LIMIT) select.creditLimit = true;
	if (DEBT_HAS_DUE_DAY) select.dueDay = true;
	if (DEBT_HAS_DUE_DATE) select.dueDate = true;
	if (DEBT_HAS_LAST_ACCRUAL_MONTH) select.lastAccrualMonth = true;
	if (DEBT_HAS_DEFAULT_PAYMENT_SOURCE) select.defaultPaymentSource = true;
	if (DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID) select.defaultPaymentCardDebtId = true;
	if (DEBT_HAS_INTEREST_RATE) select.interestRate = true;
	if (DEBT_HAS_INSTALLMENT_MONTHS) select.installmentMonths = true;

	const debts = (await prisma.debt.findMany({
		where: budgetPlanId ? { budgetPlanId } : undefined,
		select,
	})) as unknown as DebtRow[];

	const targets = debts.filter((d) => /^debt-\d+$/.test(d.id));
	if (!targets.length) {
		console.log("No debts with legacy ids (debt-<n>) found.");
		return;
	}

	const mapping: Record<string, string> = {};
	for (const d of targets) mapping[d.id] = randomUUID();

	console.log("Legacy debt ids to migrate:");
	for (const [from, to] of Object.entries(mapping)) console.log(`- ${from} -> ${to}`);

	if (!apply) {
		console.log("\nDry run only. Re-run with --apply to perform the migration.");
		console.log("Optional: add --update-seed-files to rewrite data/**/debts.json + debt-payments.json");
		return;
	}

	const oldIds = Object.keys(mapping);

	await prisma.$transaction(async (tx) => {
		// 1) Create new debt rows.
		for (const debt of targets) {
			const newId = mapping[debt.id]!;
			const data: any = {
				id: newId,
				name: debt.name,
				type: debt.type as any,
				initialBalance: debt.initialBalance,
				currentBalance: debt.currentBalance,
				amount: debt.amount,
				paid: debt.paid,
				paidAmount: debt.paidAmount,
				monthlyMinimum: (debt as any).monthlyMinimum ?? null,
				budgetPlanId: debt.budgetPlanId,
				sourceType: (debt as any).sourceType ?? null,
				sourceExpenseId: (debt as any).sourceExpenseId ?? null,
				sourceMonthKey: (debt as any).sourceMonthKey ?? null,
				sourceCategoryId: (debt as any).sourceCategoryId ?? null,
				sourceCategoryName: (debt as any).sourceCategoryName ?? null,
				sourceExpenseName: (debt as any).sourceExpenseName ?? null,
				createdAt: debt.createdAt,
			};
			if (DEBT_HAS_CREDIT_LIMIT) data.creditLimit = (debt as any).creditLimit ?? null;
			if (DEBT_HAS_DUE_DAY) data.dueDay = (debt as any).dueDay ?? null;
			if (DEBT_HAS_DUE_DATE) data.dueDate = (debt as any).dueDate ?? null;
			if (DEBT_HAS_LAST_ACCRUAL_MONTH) data.lastAccrualMonth = (debt as any).lastAccrualMonth ?? null;
			if (DEBT_HAS_DEFAULT_PAYMENT_SOURCE) data.defaultPaymentSource = (debt as any).defaultPaymentSource;
			if (DEBT_HAS_DEFAULT_PAYMENT_CARD_DEBT_ID) {
				data.defaultPaymentCardDebtId = (debt as any).defaultPaymentCardDebtId
					? (mapping[(debt as any).defaultPaymentCardDebtId] ?? (debt as any).defaultPaymentCardDebtId)
					: null;
			}
			if (DEBT_HAS_INTEREST_RATE) data.interestRate = (debt as any).interestRate ?? null;
			if (DEBT_HAS_INSTALLMENT_MONTHS) data.installmentMonths = (debt as any).installmentMonths ?? null;

			await tx.debt.create({
				data,
			});
		}

		// 2) Repoint foreign keys.
		for (const oldId of oldIds) {
			const newId = mapping[oldId]!;
			await tx.debtPayment.updateMany({ where: { debtId: oldId }, data: { debtId: newId } });
			await tx.debtPayment.updateMany({ where: { cardDebtId: oldId }, data: { cardDebtId: newId } });
			await tx.expensePayment.updateMany({ where: { debtId: oldId }, data: { debtId: newId } });
			await tx.debt.updateMany({ where: { defaultPaymentCardDebtId: oldId }, data: { defaultPaymentCardDebtId: newId } });
		}

		// 3) Remove the old rows.
		await tx.debt.deleteMany({ where: { id: { in: oldIds } } });
	});

	const remaining = await prisma.debt.count({ where: { id: { in: oldIds } } });
	if (remaining > 0) {
		throw new Error(`Migration incomplete: ${remaining} legacy debt ids still exist.`);
	}

	console.log("\n✓ Debt id migration complete.");

	if (updateSeedFiles) {
		console.log("\nUpdating data/** seed JSON files...");
		await updateJsonFiles(mapping);
		console.log("✓ Seed JSON update complete.");
	}
}

main()
	.catch((err) => {
		console.error("❌ migrate-debt-ids failed:", err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
