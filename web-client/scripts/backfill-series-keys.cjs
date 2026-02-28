"use strict";
// Backfill seriesKey for all expenses that don't have one.
// - If a matching expense exists in another month (same plan, matched by name/domain)
//   and THAT expense already has a seriesKey, reuse it.
// - Otherwise compute from merchantDomain ?? name.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 160);

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[DRY RUN] No DB writes will happen.\n");

async function main() {
  // Fetch every expense without a seriesKey, grouped by budgetPlan
  const noKey = await prisma.expense.findMany({
    where: { OR: [{ seriesKey: null }, { seriesKey: "" }] },
    select: {
      id: true,
      name: true,
      merchantDomain: true,
      categoryId: true,
      budgetPlanId: true,
      year: true,
      month: true,
    },
    orderBy: [{ budgetPlanId: "asc" }, { year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
  });

  console.log(`Expenses missing seriesKey: ${noKey.length}`);
  if (noKey.length === 0) { console.log("Nothing to do."); return; }

  // For each unique budgetPlanId, fetch all expenses WITH a seriesKey
  const planIds = [...new Set(noKey.map((e) => e.budgetPlanId))];
  const withKey = await prisma.expense.findMany({
    where: {
      budgetPlanId: { in: planIds },
      seriesKey: { not: null },
    },
    select: { id: true, name: true, merchantDomain: true, seriesKey: true, budgetPlanId: true },
  });

  // Build a lookup: planId -> list of {normKey, seriesKey}
  const planLookup = new Map();
  for (const e of withKey) {
    if (!planLookup.has(e.budgetPlanId)) planLookup.set(e.budgetPlanId, []);
    const domKey = e.merchantDomain ? norm(e.merchantDomain) : null;
    const nameKey = norm(e.name);
    planLookup.get(e.budgetPlanId).push({ domKey, nameKey, seriesKey: e.seriesKey });
  }

  let updated = 0;
  let computed = 0;

  for (const e of noKey) {
    const candidates = planLookup.get(e.budgetPlanId) || [];
    const eDomKey = e.merchantDomain ? norm(e.merchantDomain) : null;
    const eNameKey = norm(e.name);

    // Try to find an existing seriesKey from another expense in the same plan
    let foundKey = null;
    for (const c of candidates) {
      if (eDomKey && c.domKey && eDomKey === c.domKey) { foundKey = c.seriesKey; break; }
      if (eDomKey && c.nameKey && eDomKey === c.nameKey) { foundKey = c.seriesKey; break; }
      if (eNameKey && c.domKey && eNameKey === c.domKey) { foundKey = c.seriesKey; break; }
      if (eNameKey && c.nameKey && eNameKey === c.nameKey) { foundKey = c.seriesKey; break; }
    }

    const finalKey = foundKey ? norm(foundKey) : (eDomKey || eNameKey);

    if (!finalKey) {
      console.log(`  SKIP (no key computed): ${e.name} id=${e.id}`);
      continue;
    }

    const source = foundKey ? "LINKED" : "COMPUTED";
    console.log(`  [${source}] ${e.year}-${String(e.month).padStart(2,"0")} "${e.name}" => seriesKey="${finalKey}"`);

    if (!DRY_RUN) {
      await prisma.expense.update({
        where: { id: e.id },
        data: { seriesKey: finalKey },
      });
      // Also add this to the in-memory lookup so subsequent expenses in same plan can link to it
      if (!planLookup.has(e.budgetPlanId)) planLookup.set(e.budgetPlanId, []);
      planLookup.get(e.budgetPlanId).push({ domKey: eDomKey, nameKey: eNameKey, seriesKey: finalKey });
    }

    if (foundKey) updated++; else computed++;
  }

  console.log(`\nDone. Linked=${updated} Computed=${computed} Total=${updated+computed}${DRY_RUN ? " [DRY RUN - not written]" : ""}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
