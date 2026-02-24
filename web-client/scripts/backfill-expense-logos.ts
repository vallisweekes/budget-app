import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveExpenseLogoWithSearch } from "../lib/expenses/logoResolver";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (val && !val.startsWith("--")) {
      args[key] = val;
      i++;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === "true";
  const budgetPlanId = args.plan;
  const limit = Number.isFinite(Number(args.limit)) ? Number(args.limit) : 200;

  const scriptDatasourceUrl =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL_NON_POOLING?.replace?.("postgres://", "postgresql://") ??
    undefined;

  const prisma = new PrismaClient({
    datasources: scriptDatasourceUrl
      ? {
          db: {
            url: scriptDatasourceUrl,
          },
        }
      : undefined,
  });

  try {
    const where = {
      ...(budgetPlanId ? { budgetPlanId } : {}),
      OR: [
        { merchantDomain: null },
        { logoUrl: null },
      ],
    };

    const rows = await prisma.expense.findMany({
      where,
      select: {
        id: true,
        name: true,
        merchantDomain: true,
      },
      orderBy: [{ updatedAt: "asc" }],
      take: limit,
    });

    if (rows.length === 0) {
      console.log("No expenses found needing logo enrichment.");
      return;
    }

    console.log(`Found ${rows.length} expenses to inspect (apply=${apply}).`);

    let enriched = 0;
    let skipped = 0;
    const updates: Array<{ id: string; merchantDomain: string | null; logoUrl: string | null; logoSource: string | null }> = [];

    for (const row of rows) {
      const resolved = await resolveExpenseLogoWithSearch(row.name, row.merchantDomain);
      if (!resolved.merchantDomain || !resolved.logoUrl) {
        skipped++;
        continue;
      }
      updates.push({
        id: row.id,
        merchantDomain: resolved.merchantDomain,
        logoUrl: resolved.logoUrl,
        logoSource: resolved.logoSource,
      });
      enriched++;
    }

    if (!apply) {
      console.log(`Dry run complete: enrichable=${enriched}, skipped=${skipped}.`);
      console.log("Run with --apply to persist updates.");
      return;
    }

    for (const item of updates) {
      await prisma.expense.update({
        where: { id: item.id },
        data: {
          merchantDomain: item.merchantDomain,
          logoUrl: item.logoUrl,
          logoSource: item.logoSource,
        },
      });
    }

    console.log(`Applied updates: ${updates.length}. skipped=${skipped}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
