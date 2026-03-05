import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvIfPresent(cwd: string) {
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
  ];

  for (const file of envFiles) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

function resolveDbUrl(): string | undefined {
  return process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
}

async function main() {
  loadDotEnvIfPresent(process.cwd());
  const dbUrl = resolveDbUrl();
  if (!dbUrl) {
    console.error("No DB URL found.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const needleUser = (process.env.CHECK_USER ?? "vallis").trim();
  const targetExpenseId = (process.env.EXPENSE_ID ?? "cmm3lzj3k0001l7049wu6zlkj").trim();
  const apply = String(process.env.APPLY ?? "").trim() === "1";

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { contains: needleUser, mode: "insensitive" } },
        { email: { contains: needleUser, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.log(`No user matched: ${needleUser}`);
    await prisma.$disconnect().catch(() => null);
    return;
  }

  const expense = await prisma.expense.findFirst({
    where: {
      id: targetExpenseId,
      budgetPlan: { userId: user.id },
    },
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      isAllocation: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      periodKey: true,
    },
  });

  if (!expense) {
    console.log("Target expense not found for matched user", { targetExpenseId, user });
    await prisma.$disconnect().catch(() => null);
    return;
  }

  console.log("BEFORE", {
    user,
    expense,
  });

  if (!apply) {
    console.log("Dry run only. Re-run with APPLY=1 to update isAllocation=false.");
    await prisma.$disconnect().catch(() => null);
    return;
  }

  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: { isAllocation: false },
    select: {
      id: true,
      name: true,
      month: true,
      year: true,
      isAllocation: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      periodKey: true,
    },
  });

  console.log("AFTER", updated);

  await prisma.$disconnect().catch(() => null);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exitCode = 1;
});
