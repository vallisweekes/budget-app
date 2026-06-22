import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  apply: boolean;
  user: string;
  expenseCount: number;
  debtCount: number;
};

const EXPENSE_NAME_POOL = [
  "Corner Shop Run",
  "Metro Commute",
  "Coffee Catch-up",
  "Streaming Bundle",
  "Weekly Groceries",
  "Pharmacy Pickup",
  "Lunch Spot",
  "Fuel Top-up",
  "Mobile Data Pack",
  "Home Essentials",
  "Family Dinner",
  "Gym Drop-in",
  "Cinema Night",
  "Pet Supplies",
  "Quick Hardware Stop",
  "Laundry Service",
  "Taxi Ride",
  "Bakery Treat",
  "Office Snacks",
  "Weekend Brunch",
  "Bookstore Visit",
  "Garden Supplies",
  "Subscription Renewal",
  "Parking Charge",
];

const DEBT_NAME_POOL = [
  "Everyday Card",
  "Travel Card",
  "Household Loan",
  "Emergency Loan",
  "Store Balance",
  "Appliance Plan",
  "Vehicle Loan",
  "Tuition Loan",
  "Family Advance",
  "Short-term Credit",
];

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }

  const expenseCountRaw = Number(args.get("expense-count") ?? 20);
  const debtCountRaw = Number(args.get("debt-count") ?? 4);

  return {
    apply: Boolean(args.get("apply")),
    user: String(args.get("user") ?? "Smith").trim(),
    expenseCount: Number.isFinite(expenseCountRaw) ? Math.max(1, Math.floor(expenseCountRaw)) : 20,
    debtCount: Number.isFinite(debtCountRaw) ? Math.max(1, Math.floor(debtCountRaw)) : 4,
  };
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomExpenseAmount(current: number): number {
  const floor = Math.max(8, Math.round(current * 0.55));
  const ceiling = Math.max(floor + 5, Math.round(current * 1.45));
  const value = floor + Math.random() * (ceiling - floor);
  return Math.round(value * 100) / 100;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { equals: opts.user, mode: "insensitive" } },
        { email: { equals: opts.user, mode: "insensitive" } },
      ],
    },
    include: {
      budgetPlans: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    throw new Error(`User '${opts.user}' not found`);
  }

  const planIds = user.budgetPlans.map((p) => p.id);
  if (planIds.length === 0) {
    throw new Error(`User '${opts.user}' has no budget plans`);
  }

  const [expenses, debts] = await Promise.all([
    prisma.expense.findMany({
      where: { budgetPlanId: { in: planIds } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, amount: true },
    }),
    prisma.debt.findMany({
      where: { budgetPlanId: { in: planIds } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true },
    }),
  ]);

  const selectedExpenses = shuffle(expenses).slice(0, Math.min(opts.expenseCount, expenses.length));
  const selectedDebts = shuffle(debts).slice(0, Math.min(opts.debtCount, debts.length));

  const expenseUpdates = selectedExpenses.map((expense, index) => {
    const base = EXPENSE_NAME_POOL[index % EXPENSE_NAME_POOL.length];
    const suffix = index >= EXPENSE_NAME_POOL.length ? ` ${index + 1}` : "";
    const newName = `${base}${suffix}`;
    const currentAmount = Number(expense.amount);
    const newAmount = randomExpenseAmount(currentAmount);
    return {
      id: expense.id,
      oldName: expense.name,
      newName,
      oldAmount: currentAmount,
      newAmount,
    };
  });

  const debtUpdates = selectedDebts.map((debt, index) => {
    const base = DEBT_NAME_POOL[index % DEBT_NAME_POOL.length];
    const suffix = index >= DEBT_NAME_POOL.length ? ` ${index + 1}` : "";
    return {
      id: debt.id,
      oldName: debt.name,
      newName: `${base}${suffix}`,
    };
  });

  console.log("Randomization preview");
  console.log(`user: ${user.name ?? "(no name)"} <${user.email ?? "no-email"}>`);
  console.log(`plans: ${user.budgetPlans.length}`);
  console.log(`expense updates: ${expenseUpdates.length}/${expenses.length}`);
  console.log(`debt updates: ${debtUpdates.length}/${debts.length}`);

  for (const item of expenseUpdates.slice(0, 8)) {
    console.log(`expense ${item.id}: '${item.oldName}' -> '${item.newName}', ${item.oldAmount.toFixed(2)} -> ${item.newAmount.toFixed(2)}`);
  }
  for (const item of debtUpdates.slice(0, 8)) {
    console.log(`debt ${item.id}: '${item.oldName}' -> '${item.newName}'`);
  }

  if (!opts.apply) {
    console.log("DRY RUN: add --apply to persist updates");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of expenseUpdates) {
      await tx.expense.update({
        where: { id: item.id },
        data: {
          name: item.newName,
          amount: item.newAmount,
        },
      });
    }

    for (const item of debtUpdates) {
      await tx.debt.update({
        where: { id: item.id },
        data: {
          name: item.newName,
        },
      });
    }
  });

  console.log("Applied successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
