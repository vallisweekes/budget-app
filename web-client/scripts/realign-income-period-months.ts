import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  user: string;
  apply: boolean;
  year?: number;
};

function parseArgs(argv: string[]): CliOptions {
  let user = "vallis";
  let apply = false;
  let year: number | undefined;

  for (const raw of argv) {
    const arg = String(raw ?? "").trim();
    if (!arg) continue;

    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg.startsWith("--user=")) {
      user = arg.slice("--user=".length).trim() || user;
      continue;
    }

    if (arg.startsWith("--year=")) {
      const parsed = Number(arg.slice("--year=".length));
      if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
        year = parsed;
      }
      continue;
    }
  }

  return { user, apply, year };
}

function shiftToNextMonth(year: number, month: number): { year: number; month: number } {
  if (month >= 1 && month <= 11) return { year, month: month + 1 };
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month };
}

function cadenceLabel(value: string | null | undefined): "monthly" | "every_2_weeks" | "weekly" {
  if (value === "every_2_weeks" || value === "weekly") return value;
  return "monthly";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: options.user },
        { email: options.user },
        { id: options.user },
      ],
    },
    select: {
      id: true,
      name: true,
      budgetPlans: {
        select: { id: true, name: true, kind: true },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!user) {
    console.error(`User not found for --user=${options.user}`);
    process.exitCode = 1;
    return;
  }

  const profile = await prisma.userOnboardingProfile.findUnique({
    where: { userId: user.id },
    select: { payFrequency: true },
  }).catch(() => null);

  const payFrequency = cadenceLabel(profile?.payFrequency);

  console.log("Period realignment target");
  console.log(`- user: ${user.name ?? user.id}`);
  console.log(`- payFrequency: ${payFrequency}`);
  console.log(`- year filter: ${typeof options.year === "number" ? options.year : "all"}`);
  console.log(`- mode: ${options.apply ? "APPLY" : "DRY RUN"}`);

  if (payFrequency !== "monthly") {
    console.log("\nNo DB writes performed.");
    console.log("This realignment script only auto-migrates monthly cadence because current Income rows only store month/year (no received date). Weekly/biweekly needs dated income records for safe migration.");
    return;
  }

  let totalRows = 0;
  let totalUpdates = 0;

  for (const plan of user.budgetPlans) {
    const rows = await prisma.income.findMany({
      where: {
        budgetPlanId: plan.id,
        ...(typeof options.year === "number" ? { year: options.year } : {}),
      },
      select: {
        id: true,
        name: true,
        amount: true,
        month: true,
        year: true,
      },
      orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
    });

    totalRows += rows.length;
    if (rows.length === 0) {
      console.log(`\nPlan ${plan.name} (${plan.id}) -> no income rows matched`);
      continue;
    }

    const updates = rows.map((row) => {
      const target = shiftToNextMonth(row.year, row.month);
      return {
        id: row.id,
        name: row.name,
        amount: Number(row.amount),
        fromYear: row.year,
        fromMonth: row.month,
        toYear: target.year,
        toMonth: target.month,
      };
    });

    totalUpdates += updates.length;

    console.log(`\nPlan ${plan.name} (${plan.id})`);
    console.log(`- rows: ${rows.length}`);
    for (const preview of updates.slice(0, 8)) {
      console.log(`  • ${String(preview.fromMonth).padStart(2, "0")}/${preview.fromYear} -> ${String(preview.toMonth).padStart(2, "0")}/${preview.toYear} | ${preview.name} £${preview.amount.toFixed(2)}`);
    }
    if (updates.length > 8) {
      console.log(`  • ... ${updates.length - 8} more`);
    }

    if (options.apply) {
      await prisma.$transaction(
        updates.map((u) => prisma.income.update({
          where: { id: u.id },
          data: { month: u.toMonth, year: u.toYear },
        }))
      );
      console.log("- applied");
    } else {
      console.log("- dry-run only (no writes)");
    }
  }

  console.log("\nSummary");
  console.log(`- plans scanned: ${user.budgetPlans.length}`);
  console.log(`- rows scanned: ${totalRows}`);
  console.log(`- rows ${options.apply ? "updated" : "to update"}: ${totalUpdates}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
