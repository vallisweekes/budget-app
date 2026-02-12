import fs from "node:fs/promises";
import path from "node:path";

export type BudgetStrategy = "zeroBased" | "fiftyThirtyTwenty" | "payYourselfFirst";

export interface Settings {
  payDate: number;
  monthlyAllowance?: number;
  savingsBalance?: number;
  monthlySavingsContribution?: number;
  monthlyInvestmentContribution?: number;
  budgetStrategy?: BudgetStrategy;
}

const filePath = path.join(process.cwd(), "data", "settings.json");

function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const payDateRaw = Number(input?.payDate ?? 27);
  const payDate = Math.max(1, Math.min(31, Number.isFinite(payDateRaw) ? payDateRaw : 27));

  const monthlyAllowance = Number(input?.monthlyAllowance ?? 0);
  const savingsBalance = Number(input?.savingsBalance ?? 0);
  const monthlySavingsContribution = Number(input?.monthlySavingsContribution ?? 0);
  const monthlyInvestmentContribution = Number(input?.monthlyInvestmentContribution ?? 0);

  const budgetStrategy =
    input?.budgetStrategy === "zeroBased" ||
    input?.budgetStrategy === "fiftyThirtyTwenty" ||
    input?.budgetStrategy === "payYourselfFirst"
      ? input.budgetStrategy
      : undefined;

  return {
    payDate,
    monthlyAllowance: Number.isFinite(monthlyAllowance) ? monthlyAllowance : 0,
    savingsBalance: Number.isFinite(savingsBalance) ? savingsBalance : 0,
    monthlySavingsContribution: Number.isFinite(monthlySavingsContribution) ? monthlySavingsContribution : 0,
    monthlyInvestmentContribution: Number.isFinite(monthlyInvestmentContribution)
      ? monthlyInvestmentContribution
      : 0,
    budgetStrategy,
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const buf = await fs.readFile(filePath);
    const parsed = JSON.parse(buf.toString());
    return normalizeSettings(parsed);
  } catch (e: any) {
    if (e?.code === "ENOENT") return normalizeSettings(null);
    throw e;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(s, null, 2) + "\n");
}
