import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const activePlanId = "cmqmya1fz00026tqf0ssviw92";

  const activePlan = await prisma.budgetPlan.findUnique({
    where: { id: activePlanId },
    select: {
      id: true,
      name: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  console.log("active plan owner", activePlan);

  const now = new Date();
  const planUpcoming = await prisma.expense.findMany({
    where: { budgetPlanId: activePlanId, paid: false, dueDate: { gte: now } },
    orderBy: { dueDate: "asc" },
    take: 12,
    select: { id: true, name: true, dueDate: true, amount: true },
  });

  console.log("upcoming for active plan");
  for (const e of planUpcoming) {
    console.log(e.id, e.name, e.dueDate?.toISOString() ?? "no-due", String(e.amount));
  }

  const smithUsers = await prisma.user.findMany({
    where: { name: { equals: "Smith", mode: "insensitive" } },
    select: { id: true, name: true, email: true, budgetPlans: { select: { id: true, name: true } } },
  });

  console.log("smith users", smithUsers.length);
  for (const u of smithUsers) {
    console.log("smith", u.id, u.email ?? "no-email", u.budgetPlans.map((p) => `${p.id}:${p.name}`).join(" | "));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
