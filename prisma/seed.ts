import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { MONTHS } from "@/lib/constants/time";
import type { MonthKey } from "@/types";

const prisma = new PrismaClient();

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
    where: { userId: user.id, name: "personal" },
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
          name: "personal",
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

  // 2. Seed Expenses
  console.log("\n💰 Seeding expenses...");
  const expensesData = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "expenses.monthly.json"), "utf-8")
  );

  let expenseCount = 0;
  const currentYear = new Date().getFullYear();
  
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
