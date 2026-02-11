import { computeYear, fixedMonthly, MONTHS } from "../lib/budget/engine";

// Demo inputs: RENT, MORTGAGE, COUNCIL TAX similar to sheet
const rent = fixedMonthly("RENT", 1110);
const mortgage = fixedMonthly("MORTGAGE", 825);
const council = fixedMonthly("COUNCIL TAX", 170);

// Example: adjust JUNE/JULY values to match sample variations
rent.amounts["JUNE"] = 1175;
rent.amounts["JULY"] = 1175;

const year = computeYear({
  yearLabel: "2026 - 2027",
  categories: [rent, mortgage, council],
});

console.log(JSON.stringify(year, null, 2));

// Show per-month subtotal as a quick check
const perMonthTotals = MONTHS.reduce<Record<string, number>>((acc, m) => {
  acc[m] = (rent.amounts[m] ?? 0) + (mortgage.amounts[m] ?? 0) + (council.amounts[m] ?? 0);
  return acc;
}, {});

console.log(JSON.stringify({ perMonthTotals }, null, 2));
