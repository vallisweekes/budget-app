"use server";

import { computeYear, fixedMonthly, MONTHS } from "@/lib/budget/engine";

export interface BudgetInputs {
  yearLabel: string;
  rent: number;
  mortgage: number;
  councilTax: number;
  ee?: number;
  sky?: number;
  electricity?: number;
  water?: number;
  custom?: Array<{ name: string; amount: number }>;
}

export interface BudgetResult {
  subtotal: number;
  perMonthTotals: Record<string, number>;
  categories: Array<{ name: string; yearTotal: number }>;
}

function toNumber(val: FormDataEntryValue | null, def = 0): number {
  if (val === null) return def;
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

export async function calculateBudget(_prev: unknown, formData: FormData): Promise<BudgetResult> {
  const inputs: BudgetInputs = {
    yearLabel: String(formData.get("yearLabel") || "2026 - 2027"),
    rent: toNumber(formData.get("rent"), 0),
    mortgage: toNumber(formData.get("mortgage"), 0),
    councilTax: toNumber(formData.get("councilTax"), 0),
    ee: toNumber(formData.get("ee"), 0),
    sky: toNumber(formData.get("sky"), 0),
    electricity: toNumber(formData.get("electricity"), 0),
    water: toNumber(formData.get("water"), 0),
  };

  // Helper to read 12-month values for a category from FormData keys like rent[JANUARY]
  const readMonthly = (prefix: string) => {
    const amt: Record<string, number> = {};
    for (const m of MONTHS) {
      const v = toNumber(formData.get(`${prefix}[${m}]`), 0);
      if (Number.isFinite(v)) amt[m] = v;
    }
    return amt;
  };

  // Parse dynamic custom categories: catName[] + catAmount[]
  const names: string[] = [];
  const amounts: number[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "catName[]") names.push(String(value));
    else if (key === "catAmount[]") amounts.push(toNumber(value));
  }
  if (names.length) {
    inputs.custom = names.map((name, i) => ({ name, amount: amounts[i] ?? 0 })).filter(c => c.name);
  }

  // Prefer per-month values if provided; fall back to fixed monthly inputs
  const categories: Array<{ name: string; amounts: Record<string, number> }> = [];
  const rentM = readMonthly("rent");
  const mortM = readMonthly("mortgage");
  const ctM = readMonthly("councilTax");
  const eeM = readMonthly("ee");
  const skyM = readMonthly("sky");
  const elM = readMonthly("electricity");
  const waM = readMonthly("water");

  const pushIfAny = (name: string, m: Record<string, number>, fallback?: number) => {
    const sum = Object.values(m).reduce((a, b) => a + (b || 0), 0);
    if (sum > 0) categories.push({ name, amounts: m });
    else if (fallback && fallback > 0) categories.push({ name, amounts: MONTHS.reduce((acc, mo) => { acc[mo] = fallback!; return acc; }, {} as Record<string, number>) });
  };

  pushIfAny("RENT", rentM, inputs.rent);
  pushIfAny("MORTGAGE", mortM, inputs.mortgage);
  pushIfAny("COUNCIL TAX", ctM, inputs.councilTax);
  pushIfAny("EE", eeM, inputs.ee);
  pushIfAny("SKY", skyM, inputs.sky);
  pushIfAny("ELECTRICITY", elM, inputs.electricity);
  pushIfAny("THAMES WATER", waM, inputs.water);

  const customs = (inputs.custom ?? []).map((c) => ({ name: c.name, amounts: MONTHS.reduce((acc, mo) => { acc[mo] = c.amount; return acc; }, {} as Record<string, number>) }));

  const year = computeYear({
    yearLabel: inputs.yearLabel,
    categories: [...categories, ...customs].map((c) => ({ name: c.name, amounts: c.amounts } as any)),
  });

  const perMonthTotals = MONTHS.reduce<Record<string, number>>((acc, m) => {
    acc[m] = year.categories.reduce((sum, c) => sum + (c.monthly[m] ?? 0), 0);
    return acc;
  }, {});

  return {
    subtotal: year.subtotal,
    perMonthTotals,
    categories: year.categories.map(c => ({ name: c.name, yearTotal: c.yearTotal })),
  };
}
