import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function migrateData() {
  try {
    // Get vallis user
    const vallis = await prisma.user.findFirst({
      where: { name: "vallis" },
      include: { budgetPlans: true },
    });

    if (!vallis) {
      console.error("User vallis not found");
      return;
    }

    const personalPlan = vallis.budgetPlans.find((p) => p.kind === "personal");
    if (!personalPlan) {
      console.error("Personal plan not found for vallis");
      return;
    }

    console.log(`Migrating data to plan: ${personalPlan.name} (${personalPlan.id})`);

    // 1. Migrate Categories
    const categoriesPath = path.join(process.cwd(), "data", "categories.json");
    const categoriesData = JSON.parse(await fs.readFile(categoriesPath, "utf-8"));
    
    console.log(`\nMigrating ${categoriesData.length} categories...`);
    for (const cat of categoriesData) {
      await prisma.category.upsert({
        where: { id: cat.id },
        create: {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || null,
          color: cat.color || null,
          featured: cat.featured || false,
          budgetPlanId: personalPlan.id,
        },
        update: {
          name: cat.name,
          icon: cat.icon || null,
          color: cat.color || null,
          featured: cat.featured || false,
        },
      });
    }
    console.log("✓ Categories migrated");

    // 2. Migrate Expenses
    const expensesPath = path.join(process.cwd(), "data", "expenses.monthly.json");
    const expensesData = JSON.parse(await fs.readFile(expensesPath, "utf-8"));
    
    const MONTH_MAP: Record<string, number> = {
      JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
      JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
    };

    let expenseCount = 0;
    for (const [monthKey, expenses] of Object.entries(expensesData)) {
      // Remove trailing spaces and convert to uppercase
      const cleanMonthKey = monthKey.trim().toUpperCase();
      const month = MONTH_MAP[cleanMonthKey];
      if (!month || !Array.isArray(expenses)) continue;

      for (const expense of expenses) {
        try {
          await prisma.expense.create({
            data: {
              name: expense.name,
              amount: expense.amount,
              paid: expense.paid || false,
              paidAmount: expense.paidAmount || 0,
              month,
              year: 2026, // Default year
              budgetPlanId: personalPlan.id,
              categoryId: expense.categoryId || null,
            },
          });
          expenseCount++;
        } catch (e: any) {
          if (e.code !== 'P2002') {
            console.log(`  Error migrating expense ${expense.name}:`, e.message);
          }
        }
      }
    }
    console.log(`✓ ${expenseCount} expenses migrated`);

    // 3. Migrate Income
    const incomePath = path.join(process.cwd(), "data", "income.monthly.json");
    const incomeData = JSON.parse(await fs.readFile(incomePath, "utf-8"));
    
    let incomeCount = 0;
    for (const [monthKey, incomes] of Object.entries(incomeData)) {
      // Remove trailing spaces and convert to uppercase
      const cleanMonthKey = monthKey.trim().toUpperCase();
      const month = MONTH_MAP[cleanMonthKey];
      if (!month || !Array.isArray(incomes)) continue;

      for (const income of incomes) {
        try {
          await prisma.income.create({
            data: {
              name: income.name,
              amount: income.amount,
              month,
              year: 2026, // Default year
              budgetPlanId: personalPlan.id,
            },
          });
          incomeCount++;
        } catch (e: any) {
          if (e.code !== 'P2002') {
            console.log(`  Error migrating income ${income.name}:`, e.message);
          }
        }
      }
    }
    console.log(`✓ ${incomeCount} income entries migrated`);

    // 4. Migrate Debts
    const debtsPath = path.join(process.cwd(), "data", "debts.json");
    const debtsData = JSON.parse(await fs.readFile(debtsPath, "utf-8"));
    
    console.log(`\nMigrating ${debtsData.length} debts...`);
    for (const debt of debtsData) {
      try {
        await prisma.debt.create({
          data: {
            id: debt.id,
            name: debt.name,
            type: debt.type || "other",
            initialBalance: debt.initialBalance || 0,
            currentBalance: debt.currentBalance || 0,
            amount: debt.amount || 0,
            paid: debt.paid || false,
            paidAmount: debt.paidAmount || 0,
            monthlyMinimum: debt.monthlyMinimum || null,
            interestRate: debt.interestRate || null,
            budgetPlanId: personalPlan.id,
            sourceType: debt.sourceType || null,
            sourceExpenseId: debt.sourceExpenseId || null,
            sourceMonthKey: debt.sourceMonthKey || null,
            sourceCategoryId: debt.sourceCategoryId || null,
            sourceCategoryName: debt.sourceCategoryName || null,
            sourceExpenseName: debt.sourceExpenseName || null,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.log(`  Skipping existing debt: ${debt.name}`);
        } else {
          throw e;
        }
      }
    }
    console.log("✓ Debts migrated");

    // 5. Migrate Goals
    const goalsPath = path.join(process.cwd(), "data", "goals.json");
    const goalsData = JSON.parse(await fs.readFile(goalsPath, "utf-8"));
    
    console.log(`\nMigrating ${goalsData.length} goals...`);
    for (const goal of goalsData) {
      try {
        // Convert hyphenated types to underscored for Prisma enum
        const goalType = goal.type.replace(/-/g, '_');
        
        await prisma.goal.create({
          data: {
            id: goal.id,
            title: goal.title,
            type: goalType,
            category: goal.category,
            description: goal.description || null,
            targetAmount: goal.targetAmount || null,
            currentAmount: goal.currentAmount || 0,
            targetYear: goal.targetYear || null,
            budgetPlanId: personalPlan.id,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.log(`  Skipping existing goal: ${goal.title}`);
        } else {
          throw e;
        }
      }
    }
    console.log("✓ Goals migrated");

    console.log("\n✅ All data migrated successfully!");
  } catch (error) {
    console.error("Error migrating data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
