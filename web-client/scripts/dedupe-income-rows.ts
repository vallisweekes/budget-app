import { prisma } from "@/lib/prisma";

type IncomeRow = {
  id: string;
  name: string;
  amount: unknown;
  month: number;
  year: number;
  budgetPlanId: string;
  createdAt: Date;
  updatedAt: Date;
  budgetPlan: {
    id: string;
    name: string;
    user: {
      email: string | null;
    };
  };
};

function toMoney(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
    if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
    if (typeof maybeDecimal.toString === "function") return Number(maybeDecimal.toString());
  }
  return Number(value);
}

function normalizeIncomeName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isAllCapsName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-Z]+/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function pickKeeper(rows: IncomeRow[]): IncomeRow {
  let best = rows[0];
  for (const row of rows.slice(1)) {
    const bestLegacy = isAllCapsName(best.name);
    const rowLegacy = isAllCapsName(row.name);
    if (bestLegacy !== rowLegacy) {
      best = rowLegacy ? best : row;
      continue;
    }

    if (row.createdAt.getTime() !== best.createdAt.getTime()) {
      best = row.createdAt < best.createdAt ? row : best;
      continue;
    }

    if (row.updatedAt.getTime() !== best.updatedAt.getTime()) {
      best = row.updatedAt < best.updatedAt ? row : best;
      continue;
    }

    if (row.id < best.id) {
      best = row;
    }
  }
  return best;
}

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
    },
    select: {
      id: true,
      name: true,
      amount: true,
      month: true,
      year: true,
      budgetPlanId: true,
      createdAt: true,
      updatedAt: true,
      budgetPlan: {
        select: {
          id: true,
          name: true,
          user: { select: { email: true } },
        },
      },
    },
    orderBy: [
      { budgetPlanId: "asc" },
      { year: "asc" },
      { month: "asc" },
      { name: "asc" },
      { createdAt: "asc" },
    ],
  });

  const groups = new Map<string, IncomeRow[]>();
  for (const row of rows) {
    const keyName = normalizeIncomeName(row.name);
    if (!keyName) continue;
    const groupKey = `${row.budgetPlanId}|${row.year}|${row.month}|${keyName}`;
    const list = groups.get(groupKey) ?? [];
    list.push(row as IncomeRow);
    groups.set(groupKey, list);
  }

  const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);

  let duplicateRowCount = 0;
  let rowsToDelete: string[] = [];

  const previewLines: string[] = [];
  for (const group of duplicateGroups) {
    duplicateRowCount += group.length;
    const keeper = pickKeeper(group);
    const deleteRows = group.filter((row) => row.id !== keeper.id);
    rowsToDelete = rowsToDelete.concat(deleteRows.map((row) => row.id));

    const userEmail = keeper.budgetPlan.user.email ?? "unknown";
    const ym = `${keeper.year}-${String(keeper.month).padStart(2, "0")}`;
    const amountSummary = group
      .map((row) => `${row.id}:${row.name}:${toMoney(row.amount).toFixed(2)}`)
      .join(" | ");

    previewLines.push(
      `${userEmail} | plan=${keeper.budgetPlan.name} (${keeper.budgetPlanId}) | ${ym} | keep=${keeper.id}:${keeper.name}:${toMoney(keeper.amount).toFixed(2)} | drop=${deleteRows.length} | ${amountSummary}`
    );
  }

  console.log(`Scanned ${rows.length} income rows.`);
  console.log(`Found ${duplicateGroups.length} duplicate groups (${duplicateRowCount} rows involved).`);
  console.log(`Rows to delete: ${rowsToDelete.length}`);

  for (const line of previewLines.slice(0, 50)) {
    console.log(`- ${line}`);
  }
  if (previewLines.length > 50) {
    console.log(`...and ${previewLines.length - 50} more duplicate groups`);
  }

  if (!apply) {
    console.log("Dry run complete. Re-run with APPLY=1 to delete duplicate rows.");
    return;
  }

  if (!rowsToDelete.length) {
    console.log("No duplicate rows found. Nothing to delete.");
    return;
  }

  const result = await prisma.income.deleteMany({
    where: { id: { in: rowsToDelete } },
  });

  console.log(`Deleted ${result.count} duplicate income rows.`);
}

main()
  .catch((error) => {
    console.error("dedupe-income-rows failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
