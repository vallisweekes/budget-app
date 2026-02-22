import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesAllocationLikeExpense(params: { name: string; categoryName?: string | null }): boolean {
  const name = norm(params.name);
  const category = norm(params.categoryName);

  const keywords = [
    "grocer",
    "grocery",
    "food",
    "dining",
    "transport",
    "travel",
    "commute",
    "uber",
    "bolt",
    "taxi",
    "bus",
    "train",
    "tfl",
  ];

  const haystack = `${name} ${category}`.trim();
  if (!haystack) return false;

  // Strong category matches
  if (category === "groceries") return true;
  if (category === "food") return true;
  if (category === "food and dining") return true;
  if (category === "food & dining") return true;
  if (category.includes("food") && category.includes("dining")) return true;
  if (category.includes("transport") || category.includes("travel")) return true;

  // Name/category keyword matches
  return keywords.some((k) => haystack.includes(k));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const budgetPlanId = String(args.get("budgetPlanId") ?? "").trim();
  const mode = String(args.get("mode") ?? "tag").trim().toLowerCase();
  const apply = Boolean(args.get("apply") ?? false);

  if (!budgetPlanId) {
    console.error("Missing --budgetPlanId");
    process.exit(1);
  }
  if (mode !== "tag" && mode !== "delete") {
    console.error("Invalid --mode. Use tag|delete");
    process.exit(1);
  }

  type CleanupExpenseRow = {
    id: string;
    name: string;
    isAllocation: boolean;
    category: { name: string } | null;
  };

  const expenses = (await prisma.expense.findMany({
    where: { budgetPlanId },
    select: {
      id: true,
      name: true,
      isAllocation: true,
      category: { select: { name: true } },
    },
  } as any)) as unknown as CleanupExpenseRow[];

  const matches = expenses.filter((e) => matchesAllocationLikeExpense({ name: e.name, categoryName: e.category?.name }));
  const ids = matches.map((m) => m.id);

  console.log(`Matched ${ids.length} expense(s) in plan ${budgetPlanId}.`);
  const alreadyTagged = matches.filter((m) => m.isAllocation).length;
  console.log(`Already tagged as allocation: ${alreadyTagged}`);
  console.log(`Mode: ${mode} | Apply: ${apply}`);

  const preview = matches.slice(0, 10).map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category?.name ?? null,
    isAllocation: m.isAllocation,
  }));
  if (preview.length) {
    console.log("Preview:");
    console.table(preview);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to make changes.");
    return;
  }

  if (ids.length === 0) return;

  if (mode === "tag") {
    const updated = await prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: ({ isAllocation: true } as any),
    });

    // Clear any existing expense-backed debts for these expenses.
    const debts = await prisma.debt.findMany({
      where: { budgetPlanId, sourceType: "expense", sourceExpenseId: { in: ids } },
      select: { id: true },
    });

    if (debts.length) {
      await prisma.debt.updateMany({
        where: { id: { in: debts.map((d) => d.id) } },
        data: { currentBalance: 0, paid: true },
      });
    }

    console.log(`Tagged ${updated.count} expense(s) as allocations.`);
    console.log(`Cleared ${debts.length} linked debt(s).`);
    return;
  }

  // mode === "delete"
  // Clear linked debts first to avoid stale unpaid items.
  const debts = await prisma.debt.findMany({
    where: { budgetPlanId, sourceType: "expense", sourceExpenseId: { in: ids } },
    select: { id: true },
  });
  if (debts.length) {
    await prisma.debt.updateMany({
      where: { id: { in: debts.map((d) => d.id) } },
      data: { currentBalance: 0, paid: true },
    });
  }

  const deleted = await prisma.expense.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`Deleted ${deleted.count} expense(s).`);
  console.log(`Cleared ${debts.length} linked debt(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
