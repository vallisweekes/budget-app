import type {
  BillFrequency,
  PayFrequency,
  SavingsBalanceField,
  SavingsField,
  SavingsPot,
  SavingsPotStore,
} from "@/types/settings";
import type { Settings } from "@/lib/apiTypes";
import { BILL_FREQUENCY_OPTIONS, PAY_FREQUENCY_OPTIONS } from "@/lib/constants";

export function formatDateDmy(dateYmd: string): string {
  const s = (dateYmd || "").trim();
  if (!s) return "";
  return s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
}

export function normalizeDateToYmd(value: string): string | null {
  const s = (value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

export function mapSavingsFieldToSacrificeType(field: SavingsField): "savings" | "emergency" | "investment" {
  if (field === "emergency") return "emergency";
  if (field === "investment") return "investment";
  return "savings";
}

export function mapSavingsFieldToBalanceField(field: SavingsField): SavingsBalanceField {
  if (field === "emergency") return "emergencyBalance";
  if (field === "investment") return "investmentBalance";
  return "savingsBalance";
}

export function getSavingsFieldTitle(field: SavingsField): string {
  if (field === "emergency") return "Emergency funds";
  if (field === "investment") return "Investments";
  return "Savings";
}

export function mapSavingsFieldToGoalTargetKey(field: SavingsField): string {
  if (field === "emergency") return "fixed:monthlyEmergencyContribution";
  if (field === "investment") return "fixed:monthlyInvestmentContribution";
  return "fixed:monthlySavingsContribution";
}

export function formatPayFrequency(value: unknown): string {
  if (value === "weekly") return "Weekly";
  if (value === "every_2_weeks") return "Every 2 weeks";
  return "Monthly";
}

export function formatBillFrequency(value: unknown): string {
  if (value === "every_2_weeks") return "Every 2 weeks";
  return "Monthly";
}

export function parseLocaleCountry(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = String(locale).replace("_", "-").split("-");
    const region = parts.find((part) => part.length === 2 && part.toUpperCase() === part);
    return region ?? null;
  } catch {
    return null;
  }
}

export function asMoneyInput(value: string | null | undefined): string {
  if (!value) return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

export function asMoneyNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function resolveGoalCurrentAmount(
  category: string | null | undefined,
  goalCurrentAmount: string | number | null | undefined,
  settings: Pick<Settings, "savingsBalance" | "emergencyBalance" | "investmentBalance"> | null | undefined,
): number {
  const normalizedCategory = String(category ?? "").trim().toLowerCase();

  if (normalizedCategory === "emergency") {
    return Math.max(0, asMoneyNumber(settings?.emergencyBalance));
  }

  if (normalizedCategory === "savings") {
    return Math.max(0, asMoneyNumber(settings?.savingsBalance));
  }

  if (normalizedCategory === "investment") {
    return Math.max(0, asMoneyNumber(settings?.investmentBalance));
  }

  return Math.max(0, asMoneyNumber(goalCurrentAmount));
}

export function asMoneyText(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function parseSavingsPotStore(raw: string | null): SavingsPotStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: SavingsPotStore = {};
    for (const [planId, pots] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(pots)) continue;
      next[planId] = pots
        .map((pot) => {
          if (!pot || typeof pot !== "object") return null;
          const rec = pot as Record<string, unknown>;
          const field = rec.field;
          const name = typeof rec.name === "string" ? rec.name.trim() : "";
          const amountRaw = rec.amount;
          const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
          if ((field !== "savings" && field !== "emergency" && field !== "investment") || !name || !Number.isFinite(amount) || amount < 0) {
            return null;
          }
          return {
            id: typeof rec.id === "string" && rec.id ? rec.id : `${planId}-${name.toLowerCase().replace(/\s+/g, "-")}`,
            field,
            name,
            amount,
            allocationId: typeof rec.allocationId === "string" && rec.allocationId.trim() ? rec.allocationId.trim() : undefined,
          } as SavingsPot;
        })
        .filter((pot): pot is SavingsPot => Boolean(pot));
    }
    return next;
  } catch {
    return {};
  }
}

export { PAY_FREQUENCY_OPTIONS, BILL_FREQUENCY_OPTIONS };
