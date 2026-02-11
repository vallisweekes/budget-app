import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { MONTHS, MonthKey } from "../lib/budget/engine";

async function seedFromExcel() {
  const wb = XLSX.readFile("5 YEAR FINANCIAL FORECAST.xlsx");
  const sheet = wb.Sheets["PERSONAL BUDGET 2026-2027"];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  const expenses: Record<MonthKey, Array<{ id: string; name: string; amount: number; paid: boolean; categoryId?: string; isSaving?: boolean; isInvestment?: boolean }>> = {} as any;
  MONTHS.forEach((m) => (expenses[m] = []));

  // Income items that should not be in expenses
  const incomeRows = ["SALARY", "PRODUCTION", "MY EVENTS", "GIGS"];

  // Savings items that should be flagged separately
  const savingsRows = ["EMERGENCY FUNDS", "SINGLE SAVING", "HOME DEPOSIT"];
  
  // Investment items
  const investmentRows = ["TRADING 212"];

  // Category mapping for expenses
  const categoryMap: Record<string, string> = {
    // Housing
    "RENT": "housing",
    "MORTGAGE": "housing",
    "COUNCIL TAX": "housing",
    
    // Utilities
    "EE": "utilities",
    "SKY": "utilities",
    "ECLECTRICITY": "utilities",
    "ELECTRICITY": "utilities",
    "THAMES WATER": "utilities",
    "GAS": "utilities",
    
    // Insurance
    "ZURICH": "insurance",
    "APPLICANE INSURANCE": "insurance",
    "LIFE INSURANCE": "insurance",
    
    // Transport
    "WORK TRAVEL": "transport",
    "UBER": "transport",
    
    // Food
    "FOOD": "food",
    "LUNCH": "food",
    "MONTHLY ALLOWANCE": "food",
    
    // Subscriptions
    "SERATO": "subscriptions",
    "SPLICE": "subscriptions",
    "SITE GROUND": "subscriptions",
    "DISNEY PLUS": "subscriptions",
    "NETFLIX": "subscriptions",
    "SPOTIFY": "subscriptions",
    "MICROSOFT": "subscriptions",
    "APPLE ITUNES": "subscriptions",
    "REVOLUT": "subscriptions",
    
    // Childcare
    "JAYDA": "childcare",
    "JAYDA ALLOWANCE": "childcare",
    "JAYDA SAVING 2": "childcare",
    
    // Personal
    "BARBERS": "personal",
    "AUDIO GEAR": "entertainment",
    
    // Savings
    "EMERGENCY FUNDS": "savings",
    "SINGLE SAVING": "savings",
    "HOME DEPOSIT": "savings",
  };

  // Skip these row types - they're section headers or totals
  const skipPatterns = [
    /COSTS$/i, /^UTILITIES$/i, /^ALLOWANCES$/i, /^SUBSCRIPTIONS$/i, /^CHILDCARE$/i,
    /^SELF DEVELOPMEMT$/i, /^LOAN DEBTS$/i, /^SELF CARE$/i, /^OTHER EXPENSIVE$/i,
    /^SAVINGS$/i, /^INVESTMENT CONTRIBUTION$/i, /SUB TOTAL$/i, /GRAND TOTAL/i,
    /INCOME STREAM/i, /TOTAL INCOME/i, /REMAINING/i, /EXTRA SAVING/i
  ];

  for (const row of rows) {
    const name = String(row["2026 - 2027"] || "").trim();
    if (!name) continue;
    
    // Skip section headers, subtotals, and income items
    if (skipPatterns.some(p => p.test(name))) continue;
    if (incomeRows.includes(name.toUpperCase())) continue;
    
    // Check if this is a savings or investment item
    const isSaving = savingsRows.includes(name.toUpperCase());
    const isInvestment = investmentRows.includes(name.toUpperCase());
    const categoryId = categoryMap[name.toUpperCase()];
    
    // Check if this row has any monthly values
    let hasValues = false;
    for (const m of MONTHS) {
      const val = Number(row[m] || 0);
      if (val > 0) {
        hasValues = true;
        const id = `${name.replace(/[^a-zA-Z0-9]/g, '-')}-${m}`;
        expenses[m].push({ id, name, amount: val, paid: false, isSaving, isInvestment, categoryId });
      }
    }
  }

  await fs.writeFile(
    path.join(process.cwd(), "data", "expenses.monthly.json"),
    JSON.stringify(expenses, null, 2) + "\n"
  );

  // Extract income from the bottom section
  const income: Record<MonthKey, Array<{ id: string; name: string; amount: number }>> = {} as any;
  MONTHS.forEach((m) => (income[m] = []));

  for (const row of rows) {
    const name = String(row["2026 - 2027"] || "").trim();
    if (!incomeRows.includes(name.toUpperCase())) continue;
    
    for (const m of MONTHS) {
      const val = Number(row[m] || 0);
      if (val > 0) {
        const id = `${name.replace(/[^a-zA-Z0-9]/g, '-')}-${m}`;
        income[m].push({ id, name, amount: val });
      }
    }
  }

  await fs.writeFile(
    path.join(process.cwd(), "data", "income.monthly.json"),
    JSON.stringify(income, null, 2) + "\n"
  );

  console.log("✅ Seeded expenses and income from Excel workbook");
  console.log(`   Expense items: ${Object.values(expenses).flat().length}`);
  console.log(`   Income items: ${Object.values(income).flat().length}`);
}

seedFromExcel().catch((e) => {
  console.error(e);
  process.exit(1);
});
