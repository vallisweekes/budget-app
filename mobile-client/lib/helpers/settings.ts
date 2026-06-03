import type {
  SavingsBalanceField,
  SavingsField,
  SavingsPot,
  SavingsPotStore,
} from "@/types/settings";
import type { IncomeSacrificeCustomItem, IncomeSacrificeFixed, Settings } from "@/lib/apiTypes";
import { PAY_FREQUENCY_OPTIONS } from "@/lib/constants";

export type SavingsCategoryTotals = Record<SavingsField, number>;

const SAVINGS_FIELDS: SavingsField[] = ["savings", "emergency", "investment"];
const EURO_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

const COUNTRY_CURRENCY_OVERRIDES: Record<string, string> = {
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  TT: "TTD",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  NG: "NGN",
  ZA: "ZAR",
  IN: "INR",
  JP: "JPY",
  SG: "SGD",
};

function normalizeSavingsBucketName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

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
  if (value === "every_4_weeks") return "Every 4 weeks";
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

export function resolveCurrencyCodeForCountry(country: string | null | undefined, fallback = "GBP"): string {
  const normalized = String(country ?? "").trim().toUpperCase();
  if (!normalized) return fallback;
  if (COUNTRY_CURRENCY_OVERRIDES[normalized]) return COUNTRY_CURRENCY_OVERRIDES[normalized]!;
  if (EURO_COUNTRY_CODES.has(normalized)) return "EUR";
  return fallback;
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
  categoryTotals?: Partial<SavingsCategoryTotals> | null,
): number {
  const normalizedCategory = String(category ?? "").trim().toLowerCase();

  if (normalizedCategory === "emergency") {
    if (typeof categoryTotals?.emergency === "number") return Math.max(0, categoryTotals.emergency);
    return Math.max(0, asMoneyNumber(settings?.emergencyBalance));
  }

  if (normalizedCategory === "savings") {
    if (typeof categoryTotals?.savings === "number") return Math.max(0, categoryTotals.savings);
    return Math.max(0, asMoneyNumber(settings?.savingsBalance));
  }

  if (normalizedCategory === "investment") {
    if (typeof categoryTotals?.investment === "number") return Math.max(0, categoryTotals.investment);
    return Math.max(0, asMoneyNumber(settings?.investmentBalance));
  }

  return Math.max(0, asMoneyNumber(goalCurrentAmount));
}

export function groupSavingsPotsByField(pots: SavingsPot[]): Record<SavingsField, SavingsPot[]> {
  return {
    savings: pots.filter((pot) => pot.field === "savings"),
    emergency: pots.filter((pot) => pot.field === "emergency"),
    investment: pots.filter((pot) => pot.field === "investment"),
  };
}

type InvestmentSplitBucket = {
  name: string;
  amount: number;
};

export function reconcileMissingInvestmentSplitPots(args: {
  pots: SavingsPot[];
  investmentBalance: number;
  splitBuckets: ReadonlyArray<InvestmentSplitBucket>;
  tolerance?: number;
  planId?: string | null;
}): SavingsPot[] | null {
  const pots = args.pots;
  const splitBuckets = args.splitBuckets;
  const tolerance = args.tolerance ?? 0.005;

  if (!Array.isArray(pots) || splitBuckets.length === 0) return null;

  const splitTotal = splitBuckets.reduce((sum, bucket) => sum + asMoneyNumber(bucket.amount), 0);
  if (Math.abs(asMoneyNumber(args.investmentBalance) - splitTotal) >= tolerance) {
    return null;
  }

  const investmentPots = pots.filter((pot) => pot.field === "investment");
  if (investmentPots.length === 0 || investmentPots.length >= splitBuckets.length) {
    return null;
  }

  const canonicalNameSet = new Set(splitBuckets.map((bucket) => normalizeSavingsBucketName(bucket.name)));
  const usesOnlyCanonicalBuckets = investmentPots.every((pot) => canonicalNameSet.has(normalizeSavingsBucketName(pot.name)));
  if (!usesOnlyCanonicalBuckets) {
    return null;
  }

  const investmentByName = new Map<string, SavingsPot>(
    investmentPots.map((pot) => [normalizeSavingsBucketName(pot.name), pot]),
  );
  const missingBuckets = splitBuckets.filter((bucket) => !investmentByName.has(normalizeSavingsBucketName(bucket.name)));
  if (missingBuckets.length === 0) {
    return null;
  }

  const existingInvestmentTotal = investmentPots.reduce((sum, pot) => sum + asMoneyNumber(pot.amount), 0);
  const remainingAmount = Math.max(0, asMoneyNumber(args.investmentBalance) - existingInvestmentTotal);

  const repairedInvestmentPots = splitBuckets.map((bucket, index) => {
    const normalizedName = normalizeSavingsBucketName(bucket.name);
    const existingPot = investmentByName.get(normalizedName);
    if (existingPot) return existingPot;

    const generatedIdBase = args.planId ? `${args.planId}-${normalizedName}` : `investment-${normalizedName}-${index}`;
    const missingAmount = missingBuckets.length === 1 ? remainingAmount : asMoneyNumber(bucket.amount);

    return {
      id: generatedIdBase,
      field: "investment" as const,
      name: bucket.name,
      amount: Math.max(0, missingAmount),
      broker: "none",
    };
  });

  return [
    ...pots.filter((pot) => pot.field !== "investment"),
    ...repairedInvestmentPots,
  ];
}

export function resolveSavingsCategoryTotals(
  settings: Pick<Settings, "savingsBalance" | "emergencyBalance" | "investmentBalance"> | null | undefined,
  pots: SavingsPot[],
): SavingsCategoryTotals {
  const potsByField = groupSavingsPotsByField(pots);

  return {
    savings: potsByField.savings.length > 0
      ? potsByField.savings.reduce((sum, pot) => sum + asMoneyNumber(pot.amount), 0)
      : Math.max(0, asMoneyNumber(settings?.savingsBalance)),
    emergency: potsByField.emergency.length > 0
      ? potsByField.emergency.reduce((sum, pot) => sum + asMoneyNumber(pot.amount), 0)
      : Math.max(0, asMoneyNumber(settings?.emergencyBalance)),
    investment: potsByField.investment.length > 0
      ? potsByField.investment.reduce((sum, pot) => sum + asMoneyNumber(pot.amount), 0)
      : Math.max(0, asMoneyNumber(settings?.investmentBalance)),
  };
}

function resolveSavingsFieldForCustomItem(
  item: IncomeSacrificeCustomItem,
  potsByField: Record<SavingsField, SavingsPot[]>,
): SavingsField | null {
  for (const field of SAVINGS_FIELDS) {
    const matchedById = potsByField[field].some((pot) => pot.allocationId === item.id);
    if (matchedById) return field;
  }

  const normalizedName = normalizeSavingsBucketName(item.name);
  if (!normalizedName) return null;

  const matchedFields = SAVINGS_FIELDS.filter((field) => (
    potsByField[field].some((pot) => normalizeSavingsBucketName(pot.name) === normalizedName)
  ));

  return matchedFields.length === 1 ? matchedFields[0] : null;
}

export function resolveSavingsCategoryMonthlyTotals(
  fixed: IncomeSacrificeFixed | null | undefined,
  customItems: IncomeSacrificeCustomItem[] | null | undefined,
  pots: SavingsPot[],
): SavingsCategoryTotals {
  const potsByField = groupSavingsPotsByField(pots);
  const totals: SavingsCategoryTotals = {
    savings: Math.max(0, asMoneyNumber(fixed?.monthlySavingsContribution)),
    emergency: Math.max(0, asMoneyNumber(fixed?.monthlyEmergencyContribution)),
    investment: Math.max(0, asMoneyNumber(fixed?.monthlyInvestmentContribution)),
  };

  for (const item of customItems ?? []) {
    const field = resolveSavingsFieldForCustomItem(item, potsByField);
    if (!field) continue;
    totals[field] += Math.max(0, asMoneyNumber(item.amount));
  }

  return totals;
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
            broker: typeof rec.broker === "string" && rec.broker.trim() ? rec.broker.trim() : "none",
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

export { PAY_FREQUENCY_OPTIONS };
