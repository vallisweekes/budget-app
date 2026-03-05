import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.env.APPLY === "1" || process.env.APPLY?.toLowerCase() === "true";
  const userFilterRaw = String(process.env.CHECK_USER ?? "").trim().toLowerCase();

  const users = userFilterRaw
    ? await prisma.user.findMany({
        where: {
          email: { contains: userFilterRaw, mode: "insensitive" },
        },
        select: { id: true, email: true },
      })
    : [];

  const userIds = users.map((user) => user.id);

  const rows = await prisma.income.findMany({
    where: {
      ...(userIds.length ? { budgetPlan: { userId: { in: userIds } } } : {}),
      name: { equals: "salary", mode: "insensitive" },
      NOT: { name: "Salary" },
    },
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      budgetPlanId: true,
      budgetPlan: {
        select: {
          id: true,
          user: { select: { email: true } },
        },
      },
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  console.log(`Found ${rows.length} salary rows needing normalization.`);
  for (const row of rows.slice(0, 25)) {
    console.log(
      `- ${row.year}-${String(row.month).padStart(2, "0")} | ${row.name} -> Salary | user=${row.budgetPlan.user.email ?? "unknown"}`
    );
  }
  if (rows.length > 25) {
    console.log(`...and ${rows.length - 25} more`);
  }

  if (!apply) {
    console.log("Dry run complete. Re-run with APPLY=1 to update rows.");
    return;
  }

  if (!rows.length) {
    console.log("No updates needed.");
    return;
  }

  const result = await prisma.income.updateMany({
    where: {
      id: { in: rows.map((row) => row.id) },
    },
    data: {
      name: "Salary",
    },
  });

  console.log(`Updated ${result.count} rows to canonical name 'Salary'.`);
}

main()
  .catch((error) => {
    console.error("normalize-income-salary-name failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
