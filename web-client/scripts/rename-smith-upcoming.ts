import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { equals: "Smith", mode: "insensitive" } },
    select: { id: true, budgetPlans: { select: { id: true } } },
  });

  if (!user) {
    throw new Error("Smith not found");
  }

  const planIds = user.budgetPlans.map((plan) => plan.id);
  const now = new Date();
  const targets: Array<[string, string]> = [
    ["TwistedWave Software", "Nimbus Audio"],
    ["Microsoft", "WorkSuite 365"],
    ["Southern Housing", "Harbor Homes"],
  ];

  for (const [oldName, newName] of targets) {
    const row = await prisma.expense.findFirst({
      where: {
        budgetPlanId: { in: planIds },
        name: oldName,
        paid: false,
        dueDate: { gte: now },
      },
      orderBy: { dueDate: "asc" },
      select: { id: true, name: true, dueDate: true, amount: true },
    });

    if (!row) {
      console.log("SKIP", oldName, "(no upcoming unpaid match)");
      continue;
    }

    await prisma.expense.update({ where: { id: row.id }, data: { name: newName } });

    console.log(
      "UPDATED",
      row.id,
      `'${row.name}' -> '${newName}'`,
      row.dueDate?.toISOString() ?? "no-due-date",
      String(row.amount),
    );
  }

  const upcoming = await prisma.expense.findMany({
    where: {
      budgetPlanId: { in: planIds },
      paid: false,
      dueDate: { gte: now },
    },
    orderBy: { dueDate: "asc" },
    take: 8,
    select: { id: true, name: true, dueDate: true, amount: true },
  });

  console.log("--- upcoming preview ---");
  for (const expense of upcoming) {
    console.log(expense.id, expense.name, expense.dueDate?.toISOString() ?? "no-due-date", String(expense.amount));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
