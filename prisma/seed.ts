import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";
import { ensureBudgetDataDir, getBudgetDataFilePath } from "@/lib/storage/budgetDataPath";
import { getAllIncome, addOrUpdateIncomeAcrossMonths } from "@/lib/income/store";
import { getAllExpenses, addOrUpdateExpenseAcrossMonths } from "@/lib/expenses/store";

const prisma = new PrismaClient();

async function ensureEmptyFileBackedStores(budgetPlanId: string) {
  await ensureBudgetDataDir(budgetPlanId);

  const emptyByMonth = MONTHS.reduce((acc, m) => {
    (acc as any)[m] = [];
    return acc;
  }, {} as Record<MonthKey, unknown[]>);

  const currentYear = new Date().getFullYear();
  const expensesByYear = { [String(currentYear)]: emptyByMonth };

  await fs.writeFile(
    getBudgetDataFilePath(budgetPlanId, "expenses.byYear.json"),
    JSON.stringify(expensesByYear, null, 2) + "\n"
  );
  await fs.writeFile(
    getBudgetDataFilePath(budgetPlanId, "income.monthly.json"),
    JSON.stringify(emptyByMonth, null, 2) + "\n"
  );
  await fs.writeFile(getBudgetDataFilePath(budgetPlanId, "debts.json"), JSON.stringify([], null, 2) + "\n");
  await fs.writeFile(
    getBudgetDataFilePath(budgetPlanId, "debt-payments.json"),
    JSON.stringify([], null, 2) + "\n"
  );
  await fs.writeFile(getBudgetDataFilePath(budgetPlanId, "goals.json"), JSON.stringify([], null, 2) + "\n");
}

async function getOrCreateNamedPlan(params: {
  userId: string;
  kind: "personal" | "holiday" | "carnival";
  name: string;
}) {
  const existing = await prisma.budgetPlan.findFirst({
    where: { userId: params.userId, kind: params.kind, name: params.name },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.budgetPlan.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      name: params.name,
    },
  });
}

async function upsertSimpleCategories(budgetPlanId: string, names: string[]) {
  for (const name of names) {
    await prisma.category.upsert({
      where: {
        budgetPlanId_name: {
          budgetPlanId,
          name,
        },
      },
      update: {},
      create: {
        budgetPlanId,
        name,
      },
    });
  }
}

async function getCategoryId(budgetPlanId: string, name: string): Promise<string | undefined> {
  const row = await prisma.category.findUnique({
    where: { budgetPlanId_name: { budgetPlanId, name } },
    select: { id: true },
  });
  return row?.id;
}

async function seedDemoFileData(params: {
  budgetPlanId: string;
  kind: "personal" | "holiday" | "carnival";
}) {
  const year = new Date().getFullYear();

  const existingIncome = await getAllIncome(params.budgetPlanId);
  const existingExpenses = await getAllExpenses(params.budgetPlanId, year);
  const hasAnyIncome = MONTHS.some((m) => (existingIncome[m]?.length ?? 0) > 0);
  const hasAnyExpenses = MONTHS.some((m) => (existingExpenses[m]?.length ?? 0) > 0);
  if (hasAnyIncome || hasAnyExpenses) return;

  if (params.kind === "personal") {
    await addOrUpdateIncomeAcrossMonths(params.budgetPlanId, MONTHS, { name: "Salary", amount: 8000 });
    const housingId = await getCategoryId(params.budgetPlanId, "Housing");
    const foodId = await getCategoryId(params.budgetPlanId, "Food & Dining");
    const holidayId = await getCategoryId(params.budgetPlanId, "Holiday");
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      MONTHS,
      { name: "Rent", amount: 2500, categoryId: housingId }
    );
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      MONTHS,
      { name: "Groceries", amount: 900, categoryId: foodId }
    );
    // Personal contains a "Holiday" expense to support the future "move holiday expenses" prompt.
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      ["MARCH"],
      { name: "Beach Resort Deposit", amount: 300, categoryId: holidayId }
    );
    return;
  }

  if (params.kind === "holiday") {
    await addOrUpdateIncomeAcrossMonths(params.budgetPlanId, ["JANUARY", "FEBURARY", "MARCH"], {
      name: "Personal Transfer",
      amount: 1200,
    });
    const flightsId = await getCategoryId(params.budgetPlanId, "Flights");
    const lodgingId = await getCategoryId(params.budgetPlanId, "Lodging");
    const activitiesId = await getCategoryId(params.budgetPlanId, "Activities");
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      ["JANUARY"],
      { name: "Flight", amount: 1100, categoryId: flightsId }
    );
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      ["FEBURARY"],
      { name: "Hotel", amount: 1800, categoryId: lodgingId }
    );
    await addOrUpdateExpenseAcrossMonths(
      params.budgetPlanId,
      year,
      ["MARCH"],
      { name: "Excursions", amount: 450, categoryId: activitiesId }
    );
    return;
  }

  // carnival
  await addOrUpdateIncomeAcrossMonths(params.budgetPlanId, ["JANUARY", "FEBURARY"], {
    name: "Personal Transfer",
    amount: 800,
  });
  const costumeId = await getCategoryId(params.budgetPlanId, "Costume");
  const eventsId = await getCategoryId(params.budgetPlanId, "Events");
  await addOrUpdateExpenseAcrossMonths(
    params.budgetPlanId,
    year,
    ["JANUARY"],
    { name: "Fete Tickets", amount: 250, categoryId: eventsId }
  );
  await addOrUpdateExpenseAcrossMonths(
    params.budgetPlanId,
    year,
    ["FEBURARY"],
    { name: "Costume", amount: 950, categoryId: costumeId }
  );
}

async function main() {
  console.log("🌱 Starting database seed...\n");

  // 0. Seed default user + budget plan
  console.log("👤 Seeding default user + budget plan...");
  const settingsData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "settings.json"), "utf-8")
  );

  const defaultUsername = "vallis";
  const defaultEmail = "vallis@example.com";
  const user = await prisma.user.upsert({
    where: { email: defaultEmail },
    update: {},
    create: {
      name: defaultUsername,
      email: defaultEmail,
    },
  });

  const existingPlan = await prisma.budgetPlan.findFirst({
    where: { userId: user.id, kind: "personal" },
    orderBy: { createdAt: "desc" },
  });
  const budgetPlan = existingPlan
    ? await prisma.budgetPlan.update({
        where: { id: existingPlan.id },
        data: {
          payDate: settingsData.payDate,
          monthlyAllowance: String(settingsData.monthlyAllowance ?? 0),
          savingsBalance: String(settingsData.savingsBalance ?? 0),
          monthlySavingsContribution: String(settingsData.monthlySavingsContribution ?? 0),
          monthlyInvestmentContribution: String(settingsData.monthlyInvestmentContribution ?? 0),
          budgetStrategy: settingsData.budgetStrategy,
        },
      })
    : await prisma.budgetPlan.create({
        data: {
          kind: "personal",
          name: "Personal",
          userId: user.id,
          payDate: settingsData.payDate,
          monthlyAllowance: String(settingsData.monthlyAllowance ?? 0),
          savingsBalance: String(settingsData.savingsBalance ?? 0),
          monthlySavingsContribution: String(settingsData.monthlySavingsContribution ?? 0),
          monthlyInvestmentContribution: String(settingsData.monthlyInvestmentContribution ?? 0),
          budgetStrategy: settingsData.budgetStrategy,
        },
      });
  console.log(`  ✓ User: ${user.name} (${user.id})`);
  console.log(`  ✓ BudgetPlan: ${budgetPlan.name} (${budgetPlan.id})`);

  // Also seed the file-backed stores used by the UI.
  console.log("\n🗂️  Seeding file-backed budget data...");
  await ensureBudgetDataDir(budgetPlan.id);

  const rootExpensesMonthly = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "expenses.monthly.json"), "utf-8")
  );
  const rootIncomeMonthly = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "income.monthly.json"), "utf-8")
  );
  const rootDebts = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "debts.json"), "utf-8"));
  const rootGoals = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "goals.json"), "utf-8"));

  let rootDebtPayments: unknown = [];
  try {
    rootDebtPayments = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "debt-payments.json"), "utf-8")
    );
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }

  const currentYear = new Date().getFullYear();
  const expensesByYear = { [String(currentYear)]: rootExpensesMonthly };

  await fs.writeFile(
    getBudgetDataFilePath(budgetPlan.id, "expenses.byYear.json"),
    JSON.stringify(expensesByYear, null, 2) + "\n"
  );
  await fs.writeFile(
    getBudgetDataFilePath(budgetPlan.id, "income.monthly.json"),
    JSON.stringify(rootIncomeMonthly, null, 2) + "\n"
  );
  await fs.writeFile(getBudgetDataFilePath(budgetPlan.id, "debts.json"), JSON.stringify(rootDebts, null, 2) + "\n");
  await fs.writeFile(
    getBudgetDataFilePath(budgetPlan.id, "debt-payments.json"),
    JSON.stringify(rootDebtPayments, null, 2) + "\n"
  );
  await fs.writeFile(getBudgetDataFilePath(budgetPlan.id, "goals.json"), JSON.stringify(rootGoals, null, 2) + "\n");

  console.log("  ✓ Wrote expenses/income/debts/goals JSON files");

  // 1. Seed Categories
  console.log("📁 Seeding categories...");
  const categoriesData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "categories.json"), "utf-8")
  );

  const categoryMap = new Map<string, string>();
  
  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: {
				budgetPlanId_name: {
					budgetPlanId: budgetPlan.id,
					name: cat.name,
				},
			},
      update: {
        icon: cat.icon,
        color: cat.color,
        featured: cat.featured || false,
      },
      create: {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        featured: cat.featured || false,
				budgetPlanId: budgetPlan.id,
      },
    });
    categoryMap.set(cat.id, category.id);
    console.log(`  ✓ ${category.name}`);
  }

  // 6. Seed a secondary test user (test2) with multiple plan scenarios.
  console.log("\n🧪 Seeding test user + multi-plan scenarios (test2)...");
  const testUsername = "test2";
  const testEmail = "test2@example.com";
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    update: { name: testUsername },
    create: { name: testUsername, email: testEmail },
  });

  // Personal (single)
  const testPersonalExisting = await prisma.budgetPlan.findFirst({
    where: { userId: testUser.id, kind: "personal" },
    orderBy: { createdAt: "desc" },
  });
  const testPersonal = testPersonalExisting
    ? testPersonalExisting
    : await prisma.budgetPlan.create({
        data: {
          userId: testUser.id,
          kind: "personal",
          name: "Personal",
          payDate: settingsData.payDate,
          monthlyAllowance: String(settingsData.monthlyAllowance ?? 0),
          savingsBalance: String(settingsData.savingsBalance ?? 0),
          monthlySavingsContribution: String(settingsData.monthlySavingsContribution ?? 0),
          monthlyInvestmentContribution: String(settingsData.monthlyInvestmentContribution ?? 0),
          budgetStrategy: settingsData.budgetStrategy,
        },
      });

  // Holiday (multiple) - covers "Jamaica twice in the same year"
  const testHoliday1 = await getOrCreateNamedPlan({ userId: testUser.id, kind: "holiday", name: "Jamaica 2026" });
  const testHoliday2 = await getOrCreateNamedPlan({
    userId: testUser.id,
    kind: "holiday",
    name: "Jamaica 2026 (Trip 2)",
  });

  // Carnival (multiple allowed; seed one)
  const testCarnival = await getOrCreateNamedPlan({ userId: testUser.id, kind: "carnival", name: "Carnival 2026" });

  // Initialize file-backed stores so pages don't hit missing directories.
  await ensureEmptyFileBackedStores(testPersonal.id);
  await ensureEmptyFileBackedStores(testHoliday1.id);
  await ensureEmptyFileBackedStores(testHoliday2.id);
  await ensureEmptyFileBackedStores(testCarnival.id);

  // Minimal categories to illustrate the scenarios.
  // Personal commonly has a broad "Holiday" category.
  await upsertSimpleCategories(testPersonal.id, ["Holiday", "Housing", "Food & Dining"]);
  await upsertSimpleCategories(testHoliday1.id, ["Flights", "Lodging", "Activities"]);
  await upsertSimpleCategories(testHoliday2.id, ["Flights", "Lodging", "Activities"]);
  await upsertSimpleCategories(testCarnival.id, ["Costume", "Events"]);

  // Seed small demo data (idempotent; only seeds if plan is empty).
  await seedDemoFileData({ budgetPlanId: testPersonal.id, kind: "personal" });
  await seedDemoFileData({ budgetPlanId: testHoliday1.id, kind: "holiday" });
  await seedDemoFileData({ budgetPlanId: testHoliday2.id, kind: "holiday" });
  await seedDemoFileData({ budgetPlanId: testCarnival.id, kind: "carnival" });

  console.log(`  ✓ User: ${testUser.name} (${testUser.id})`);
  console.log(`  ✓ Personal: ${testPersonal.name} (${testPersonal.id})`);
  console.log(`  ✓ Holiday: ${testHoliday1.name} (${testHoliday1.id})`);
  console.log(`  ✓ Holiday: ${testHoliday2.name} (${testHoliday2.id})`);
  console.log(`  ✓ Carnival: ${testCarnival.name} (${testCarnival.id})`);

  // 2. Seed Expenses
  console.log("\n💰 Seeding expenses...");
  const expensesData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "expenses.monthly.json"), "utf-8")
  );

  let expenseCount = 0;
  // Note: currentYear declared above for file-backed seed.
  
  for (const monthKey of MONTHS) {
    const monthExpenses = expensesData[monthKey] || [];
    const monthIndex = MONTHS.indexOf(monthKey as MonthKey) + 1;

    for (const expense of monthExpenses) {
      await prisma.expense.upsert({
        where: { id: expense.id },
        update: {
          name: expense.name,
          amount: expense.amount,
          paid: expense.paid,
          paidAmount: expense.paidAmount || 0,
          month: monthIndex,
          year: currentYear,
				budgetPlanId: budgetPlan.id,
				categoryId: expense.categoryId ? (categoryMap.get(expense.categoryId) ?? null) : null,
        },
        create: {
          id: expense.id,
          name: expense.name,
          amount: expense.amount,
          paid: expense.paid,
          paidAmount: expense.paidAmount || 0,
          month: monthIndex,
          year: currentYear,
				budgetPlanId: budgetPlan.id,
				categoryId: expense.categoryId ? (categoryMap.get(expense.categoryId) ?? null) : null,
        },
      });
      expenseCount++;
    }
  }
  console.log(`  ✓ ${expenseCount} expenses`);

  // 3. Seed Income
  console.log("\n💵 Seeding income...");
  const incomeData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "income.monthly.json"), "utf-8")
  );

  let incomeCount = 0;
  
  for (const monthKey of MONTHS) {
    const monthIncome = incomeData[monthKey] || [];
    const monthIndex = MONTHS.indexOf(monthKey as MonthKey) + 1;

    for (const income of monthIncome) {
      await prisma.income.upsert({
        where: { id: income.id },
        update: {
          name: income.name,
          amount: income.amount,
          month: monthIndex,
          year: currentYear,
				budgetPlanId: budgetPlan.id,
        },
        create: {
          id: income.id,
          name: income.name,
          amount: income.amount,
          month: monthIndex,
          year: currentYear,
				budgetPlanId: budgetPlan.id,
        },
      });
      incomeCount++;
    }
  }
  console.log(`  ✓ ${incomeCount} income entries`);

  // 4. Seed Debts
  console.log("\n💳 Seeding debts...");
  const debtsData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "debts.json"), "utf-8")
  );

  for (const debt of debtsData) {
    await prisma.debt.upsert({
      where: { id: debt.id },
      update: {
        name: debt.name,
        type: debt.type,
        initialBalance: debt.initialBalance,
        currentBalance: debt.currentBalance,
        amount: debt.amount,
        paid: debt.paid,
        paidAmount: debt.paidAmount || 0,
        monthlyMinimum: debt.monthlyMinimum || null,
			budgetPlanId: budgetPlan.id,
        sourceType: debt.sourceType || null,
        sourceExpenseId: debt.sourceExpenseId || null,
        sourceMonthKey: debt.sourceMonthKey || null,
        sourceCategoryId: debt.sourceCategoryId || null,
        sourceCategoryName: debt.sourceCategoryName || null,
        sourceExpenseName: debt.sourceExpenseName || null,
      },
      create: {
        id: debt.id,
        name: debt.name,
        type: debt.type,
        initialBalance: debt.initialBalance,
        currentBalance: debt.currentBalance,
        amount: debt.amount,
        paid: debt.paid,
        paidAmount: debt.paidAmount || 0,
        monthlyMinimum: debt.monthlyMinimum || null,
			budgetPlanId: budgetPlan.id,
        sourceType: debt.sourceType || null,
        sourceExpenseId: debt.sourceExpenseId || null,
        sourceMonthKey: debt.sourceMonthKey || null,
        sourceCategoryId: debt.sourceCategoryId || null,
        sourceCategoryName: debt.sourceCategoryName || null,
        sourceExpenseName: debt.sourceExpenseName || null,
        createdAt: debt.createdAt ? new Date(debt.createdAt) : new Date(),
      },
    });
  }
  console.log(`  ✓ ${debtsData.length} debts`);

  // 5. Seed Goals
  console.log("\n🎯 Seeding goals...");
  const goalsData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "goals.json"), "utf-8")
  );

  for (const goal of goalsData) {
    // Map goal type to match Prisma enum format
    const goalType = goal.type.replace(/-/g, "_") as "yearly" | "long_term" | "short_term";
    
    await prisma.goal.upsert({
      where: { id: goal.id },
      update: {
        title: goal.title,
        type: goalType,
        category: goal.category,
        description: goal.description || null,
        targetAmount: goal.targetAmount || null,
        currentAmount: goal.currentAmount || 0,
        targetYear: goal.targetYear || null,
			budgetPlanId: budgetPlan.id,
      },
      create: {
        id: goal.id,
        title: goal.title,
        type: goalType,
        category: goal.category,
        description: goal.description || null,
        targetAmount: goal.targetAmount || null,
        currentAmount: goal.currentAmount || 0,
        targetYear: goal.targetYear || null,
			budgetPlanId: budgetPlan.id,
        createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
      },
    });
  }
  console.log(`  ✓ ${goalsData.length} goals`);

  console.log("\n✅ Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
