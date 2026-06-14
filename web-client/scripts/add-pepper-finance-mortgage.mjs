/**
 * add-pepper-finance-mortgage.mjs
 *
 * Finds the Pepper Finance expense for the "vallis" user's personal budget plan,
 * creates a mortgage Debt record for it (£118,123.00, 30 years), and removes
 * the original expense.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-pepper-finance-mortgage.mjs
 *   node --env-file=.env.local scripts/add-pepper-finance-mortgage.mjs --apply
 *
 * Without --apply the script is a dry-run (shows what it will do).
 * Pass --apply to actually make the changes.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const MORTGAGE_BALANCE = 118123.0;
const TERM_MONTHS = 360; // 30 years

async function main() {
  // --- Resolve user + plan ---
  const user = await prisma.user.findFirst({
    where: { name: "vallis" },
    include: { budgetPlans: true },
  });

  if (!user) throw new Error("User 'vallis' not found");

  const plan = user.budgetPlans.find((p) => p.kind === "personal") ?? user.budgetPlans[0];
  if (!plan) throw new Error("No budget plan found for 'vallis'");

  console.log(`\nUser:  ${user.name} (${user.id})`);
  console.log(`Plan:  ${plan.name} (${plan.id})`);

  // --- Find the Pepper Finance expense ---
  const pepperExpenses = await prisma.expense.findMany({
    where: {
      budgetPlanId: plan.id,
      name: { contains: "pepper", mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });

  const mortgageExpenses = await prisma.expense.findMany({
    where: {
      budgetPlanId: plan.id,
      name: { contains: "mortgage", mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
  });

  const allCandidates = [...pepperExpenses, ...mortgageExpenses];

  if (allCandidates.length === 0) {
    console.log("\n⚠  No expenses found matching 'pepper' or 'mortgage'.");
    console.log("   Showing all expenses so you can identify the correct one:\n");
    const all = await prisma.expense.findMany({
      where: { budgetPlanId: plan.id },
      select: { id: true, name: true, amount: true, month: true, year: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    all.forEach((e) => console.log(`  ${e.name.padEnd(40)} £${e.amount}  (${e.month}/${e.year})  id=${e.id}`));
    process.exit(0);
  }

  console.log(`\nFound ${allCandidates.length} candidate expense(s):`);
  allCandidates.forEach((e) => {
    console.log(`  [${e.id}] "${e.name}" — £${e.amount}/mo  (month ${e.month}/${e.year})`);
  });

  // Use the first unique name group (most recent month) to get the monthly amount
  const representative = allCandidates[0];
  const monthlyPayment = Number(representative.amount);

  // Collect all expense IDs across months with the same name to delete
  const allMatchingExpenses = await prisma.expense.findMany({
    where: {
      budgetPlanId: plan.id,
      name: { equals: representative.name, mode: "insensitive" },
    },
    select: { id: true, name: true, amount: true, month: true, year: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  console.log(`\nWill delete ${allMatchingExpenses.length} expense record(s) named "${representative.name}":`);
  allMatchingExpenses.forEach((e) => {
    console.log(`  [${e.id}] ${e.month}/${e.year} — £${e.amount}`);
  });

  // --- Check for existing mortgage debt ---
  const existingMortgage = await prisma.debt.findFirst({
    where: {
      budgetPlanId: plan.id,
      type: "mortgage",
      name: { contains: "pepper", mode: "insensitive" },
    },
  });

  if (existingMortgage) {
    console.log(`\n⚠  Mortgage debt already exists: "${existingMortgage.name}" (${existingMortgage.id})`);
    console.log("   Skipping debt creation. Delete it first if you want to recreate it.");
  }

  // --- Summary ---
  const dueDate = new Date();
  dueDate.setUTCDate(1);
  dueDate.setUTCMonth(dueDate.getUTCMonth() + 1); // 1st of next month

  console.log("\n--- Planned changes ---");
  if (!existingMortgage) {
    console.log(`  CREATE Debt: "Pepper Finance" (mortgage)`);
    console.log(`    balance       £${MORTGAGE_BALANCE.toFixed(2)}`);
    console.log(`    term          ${TERM_MONTHS} months (30 years)`);
    console.log(`    monthly       £${monthlyPayment.toFixed(2)}`);
    console.log(`    due date      ${dueDate.toISOString().slice(0, 10)}`);
  }
  console.log(`  DELETE ${allMatchingExpenses.length} expense(s) named "${representative.name}"`);

  if (!APPLY) {
    console.log("\n[DRY RUN] Pass --apply to execute the above changes.\n");
    return;
  }

  // --- Apply ---
  await prisma.$transaction(async (tx) => {
    // 1. Create the mortgage debt
    if (!existingMortgage) {
      await tx.debt.create({
        data: {
          budgetPlanId: plan.id,
          name: "Pepper Finance",
          type: "mortgage",
          initialBalance: MORTGAGE_BALANCE,
          currentBalance: MORTGAGE_BALANCE,
          paidAmount: 0,
          paid: false,
          amount: monthlyPayment,
          monthlyMinimum: monthlyPayment,
          installmentMonths: TERM_MONTHS,
          dueDate,
          defaultPaymentSource: "income",
        },
      });
      console.log(`\n✓ Created mortgage debt: "Pepper Finance" — £${MORTGAGE_BALANCE}`);
    }

    // 2. Delete all the matching expenses
    const deleted = await tx.expense.deleteMany({
      where: {
        id: { in: allMatchingExpenses.map((e) => e.id) },
      },
    });
    console.log(`✓ Deleted ${deleted.count} expense(s)`);
  });

  console.log("\n✅  Done. Reload the app to see Pepper Finance in the Liabilities section.\n");
}

main()
  .catch((err) => {
    console.error("\n❌  Error:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
