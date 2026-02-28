import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/api/bffAuth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toInt(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeSeriesKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 160);
}

function tokenizeName(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter((t) => !/^\d+$/.test(t))
    .slice(0, 24);
}

function countTokenOverlap(a: ReadonlySet<string>, b: readonly string[]): number {
  let count = 0;
  for (const token of b) {
    if (a.has(token)) count += 1;
  }
  return count;
}

function dayOfMonthUTC(d: Date | null | undefined): number | null {
  if (!d) return null;
  const day = d.getUTCDate();
  return Number.isFinite(day) ? day : null;
}

function amountSimilarityScore(baseAmount: number, candidateAmount: number): number {
  const a = Math.abs(baseAmount);
  const b = Math.abs(candidateAmount);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  // 0..20 (same amount => 20)
  return Math.max(0, Math.min(20, Math.round(ratio * 20)));
}

function dueDateSimilarityScore(baseDue: Date | null | undefined, candidateDue: Date | null | undefined): number {
  const a = dayOfMonthUTC(baseDue);
  const b = dayOfMonthUTC(candidateDue);
  if (a == null || b == null) return 0;
  const diff = Math.abs(a - b);
  if (diff <= 1) return 15;
  if (diff <= 3) return 10;
  if (diff <= 7) return 5;
  return 0;
}

function monthLabel(month: number): string {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[Math.max(1, Math.min(12, month)) - 1] ?? "";
}

function addMonths(month: number, year: number, delta: number): { month: number; year: number } {
  let m = month;
  let y = year;
  for (let i = 0; i < Math.abs(delta); i += 1) {
    if (delta >= 0) {
      m += 1;
      if (m >= 13) {
        m = 1;
        y += 1;
      }
    } else {
      m -= 1;
      if (m <= 0) {
        m = 12;
        y -= 1;
      }
    }
  }
  return { month: m, year: y };
}

function compareMonthYear(a: { month: number; year: number }, b: { month: number; year: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function toRatio(amount: number, paidAmount: number, paid: boolean): number {
  if (amount <= 0) return 1;
  if (paid) return 1;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const r = paidAmount / amount;
  return Math.max(0, Math.min(1, Number.isFinite(r) ? r : 0));
}

export type ExpenseFrequencyPointStatus = "paid" | "partial" | "unpaid" | "missed" | "upcoming";

function toNumber(value: unknown): number {
  const maybeWithToString = value as { toString?: () => string } | null | undefined;
  const n = typeof value === "number" ? value : Number(maybeWithToString?.toString?.() ?? value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function manualAliasNameKeysForBase(base: { name: string; categoryId: string | null; seriesKey?: string | null; merchantDomain?: string | null }): Set<string> {
  const keys = new Set<string>();
  const name = String(base.name ?? "");

  // Pepper Finance was previously tracked as a generic "MORTGAGE" item.
  // Add a conservative alias so the frequency history can bridge the rename.
  const baseKey = normalizeSeriesKey(String(base.seriesKey ?? base.merchantDomain ?? name));
  if (/\bpepper\s*(finance|money)\b/i.test(name) || /^pepperfinance/.test(baseKey)) {
    keys.add(normalizeSeriesKey("mortgage"));
  }

  return keys;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest("Missing id");

  const { searchParams } = new URL(req.url);
  const monthsRaw = toInt(searchParams.get("months"));
  const months = monthsRaw == null ? 6 : Math.max(1, Math.min(12, monthsRaw));

  const baseExpense = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      merchantDomain: true,
      seriesKey: true,
      month: true,
      year: true,
      amount: true,
      categoryId: true,
      dueDate: true,
      budgetPlanId: true,
      budgetPlan: { select: { userId: true } },
      nameChanges: {
        take: 12,
        orderBy: { changedAt: "desc" },
        select: { fromName: true, toName: true },
      },
    },
  });

  if (!baseExpense || baseExpense.budgetPlan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = baseExpense;

  const storedBaseSeriesKey = typeof base.seriesKey === "string" && base.seriesKey.trim() ? base.seriesKey : null;
  const seriesKey = normalizeSeriesKey(storedBaseSeriesKey ?? base.merchantDomain ?? base.name);

  // Pull a bounded set of candidates (3 years around the current expense) then filter in memory.
  const candidateYears = [base.year - 1, base.year, base.year + 1].filter((y) => y >= 1900);

  const candidates = await prisma.expense.findMany({
    where: {
      budgetPlanId: base.budgetPlanId,
      year: { in: candidateYears },
      isAllocation: false,
    },
    select: {
      id: true,
      name: true,
      merchantDomain: true,
      seriesKey: true,
      month: true,
      year: true,
      amount: true,
      paidAmount: true,
      paid: true,
      categoryId: true,
      dueDate: true,
    },
    orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
  });

  const aliasNames = Array.from(
    new Set(
      [base.name, ...(base.nameChanges ?? []).flatMap((c) => [c.fromName, c.toName])]
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .slice(0, 25)
    )
  );
  const aliasNameKeys = new Set(aliasNames.map((n) => normalizeSeriesKey(n)).filter(Boolean));
  const manualAliasKeys = manualAliasNameKeysForBase({
    name: base.name,
    categoryId: base.categoryId ?? null,
    seriesKey: base.seriesKey ?? null,
    merchantDomain: base.merchantDomain ?? null,
  });
  const baseTokens = new Set(aliasNames.flatMap((n) => tokenizeName(n)));
  const baseAmount = toNumber(base.amount);
  const baseDueDate = base.dueDate;

  function strictProximityBonus(c: (typeof candidates)[number]): number {
    const candidateAmount = toNumber(c.amount);
    return amountSimilarityScore(baseAmount, candidateAmount) + dueDateSimilarityScore(baseDueDate, c.dueDate);
  }

  function scoreCandidate(c: (typeof candidates)[number]):
    | { score: number; kind: "strict" | "token"; tokenOverlap?: number }
    | null {
    // Ensure the base expense always wins for its month.
    if (c.id === base.id) return { score: 2_000, kind: "strict" };

    // Most stable signal: persistent seriesKey (when present).
    if (c.seriesKey && normalizeSeriesKey(c.seriesKey) === seriesKey) {
      return { score: 1_200 + strictProximityBonus(c), kind: "strict" };
    }

    // Strongest signals first.
    if (base.merchantDomain) {
      if (c.merchantDomain && normalizeSeriesKey(c.merchantDomain) === seriesKey) {
        return { score: 1_000 + strictProximityBonus(c), kind: "strict" };
      }

      // Fallback to exact normalized name match when a domain is missing for a month.
      // Use alias keys (rename history) to handle cases like Jan having the old name.
      if (aliasNameKeys.size > 0 && aliasNameKeys.has(normalizeSeriesKey(c.name))) {
        return { score: 900 + strictProximityBonus(c), kind: "strict" };
      }

      // Manual aliases for legacy naming (e.g. Pepper Finance previously recorded as "MORTGAGE").
      // Keep this conservative: require same category and strong proximity (amount + due-day).
      const manualAliasHit = (() => {
        if (manualAliasKeys.size <= 0) return false;
        const nameKey = normalizeSeriesKey(c.name);
        if (manualAliasKeys.has(nameKey)) return true;
        const candidateSeriesKey = typeof c.seriesKey === "string" && c.seriesKey.trim() ? normalizeSeriesKey(c.seriesKey) : "";
        return Boolean(candidateSeriesKey && manualAliasKeys.has(candidateSeriesKey));
      })();

      if (manualAliasHit) {
        if (base.categoryId && c.categoryId && c.categoryId === base.categoryId) {
          const proximity = strictProximityBonus(c);
          if (proximity >= 18) {
            return { score: 875 + proximity, kind: "strict" };
          }
        }
      }

      // Conservative fallback: same category + shared tokens + proximity.
      // Only used when the candidate doesn't have a domain match.
      if (base.categoryId && c.categoryId && c.categoryId === base.categoryId && baseTokens.size > 0) {
        const overlap = countTokenOverlap(baseTokens, tokenizeName(c.name));
        if (overlap > 0) {
          const tokenScore = 100 + overlap * 10;
          const proximity = strictProximityBonus(c);
          return { score: tokenScore + proximity, kind: "token", tokenOverlap: overlap };
        }
      }

      return null;
    }

    // When we don't have merchantDomain, default to strict name matching,
    // then a conservative fallback: same category + shared name tokens.
    if (normalizeSeriesKey(c.name) === seriesKey) return { score: 1_000 + strictProximityBonus(c), kind: "strict" };

    // Manual aliases in the no-domain world too.
    const manualAliasHit = (() => {
      if (manualAliasKeys.size <= 0) return false;
      const nameKey = normalizeSeriesKey(c.name);
      if (manualAliasKeys.has(nameKey)) return true;
      const candidateSeriesKey = typeof c.seriesKey === "string" && c.seriesKey.trim() ? normalizeSeriesKey(c.seriesKey) : "";
      return Boolean(candidateSeriesKey && manualAliasKeys.has(candidateSeriesKey));
    })();

    if (manualAliasHit) {
      if (base.categoryId && c.categoryId && c.categoryId === base.categoryId) {
        const proximity = strictProximityBonus(c);
        if (proximity >= 18) {
          return { score: 875 + proximity, kind: "strict" };
        }
      }
    }

    if (base.categoryId && c.categoryId && c.categoryId === base.categoryId && baseTokens.size > 0) {
      const overlap = countTokenOverlap(baseTokens, tokenizeName(c.name));
      if (overlap > 0) {
        const tokenScore = 100 + overlap * 10;
        const proximity = strictProximityBonus(c);
        return { score: tokenScore + proximity, kind: "token", tokenOverlap: overlap };
      }
    }

    return null;
  }

  const bestStrictByMonth = new Map<string, { score: number; expense: (typeof candidates)[number] }>();
  const tokenMetaByMonth = new Map<
    string,
    {
      best: { score: number; overlap: number; expense: (typeof candidates)[number] } | null;
      secondBestScore: number;
      maxOverlap: number;
      countAtMax: number;
    }
  >();

  for (const c of candidates) {
    const scored = scoreCandidate(c);
    if (scored == null) continue;
    const key = `${c.year}-${String(c.month).padStart(2, "0")}`;

    if (typeof scored === "number") {
      // Backward compat (should not happen, but keeps TS simple if refactors land oddly)
      const existing = bestStrictByMonth.get(key);
      if (!existing || scored > existing.score) bestStrictByMonth.set(key, { score: scored, expense: c });
      continue;
    }

    if (scored.kind === "strict") {
      const existing = bestStrictByMonth.get(key);
      if (!existing || scored.score > existing.score) {
        bestStrictByMonth.set(key, { score: scored.score, expense: c });
      }
      continue;
    }

    const overlap = scored.tokenOverlap ?? 0;
    const meta = tokenMetaByMonth.get(key) ?? { best: null, secondBestScore: -Infinity, maxOverlap: 0, countAtMax: 0 };
    if (overlap > meta.maxOverlap) {
      meta.maxOverlap = overlap;
      meta.countAtMax = 1;
    } else if (overlap === meta.maxOverlap) {
      meta.countAtMax += 1;
    }

    if (!meta.best || scored.score > meta.best.score) {
      if (meta.best) meta.secondBestScore = Math.max(meta.secondBestScore, meta.best.score);
      meta.best = { score: scored.score, overlap, expense: c };
    } else {
      meta.secondBestScore = Math.max(meta.secondBestScore, scored.score);
    }

    tokenMetaByMonth.set(key, meta);
  }

  const bestByMonth = new Map<
    string,
    { expense: (typeof candidates)[number]; kind: "strict" | "token"; score: number; overlap?: number }
  >();
  for (const [key, strict] of bestStrictByMonth) {
    bestByMonth.set(key, { expense: strict.expense, kind: "strict", score: strict.score });
  }

  for (const [key, meta] of tokenMetaByMonth) {
    // If we already have a strict match in a month, keep it.
    if (bestByMonth.has(key)) continue;
    if (!meta.best) continue;

    // Tightening: only accept 1-token matches when they're unique for that month.
    // If multiple candidates share only a single overlapping token, treat it as ambiguous.
    if (meta.maxOverlap <= 0) continue;
    if (meta.maxOverlap === 1 && meta.countAtMax > 1) {
      // Allow a 1-token match *only* when the best candidate is strongly supported by
      // proximity (amount + due-day) and clearly beats the runner-up.
      //
      // For overlap=1, score = 110 + proximity.
      const bestScore = meta.best.score;
      const margin = bestScore - (Number.isFinite(meta.secondBestScore) ? meta.secondBestScore : -Infinity);
      const proximity = bestScore - 110;
      // Allow missing dueDate as long as amount similarity is strong enough.
      const hasStrongProximity = proximity >= 15;
      const hasClearWinner = margin >= 12;
      if (!hasStrongProximity || !hasClearWinner) continue;
    }

    bestByMonth.set(key, {
      expense: meta.best.expense,
      kind: "token",
      score: meta.best.score,
      overlap: meta.best.overlap,
    });
  }

  const matches = [...bestByMonth.values()]
    .map((m) => m.expense)
    .sort((a, b) => compareMonthYear(a, b));

  // Opportunistic backfill: ensure the base expense has a seriesKey, and if we
  // found high-confidence matches with missing seriesKey, stamp them with the base seriesKey.
  // This makes future reads / distribute-across-months resilient to renames.
  const baseNeedsSeriesKey = storedBaseSeriesKey == null;
  const backfillIds: string[] = [];
  for (const picked of bestByMonth.values()) {
    const row = picked.expense;
    if (row.id === base.id) continue;
    if (row.seriesKey) continue;

    if (picked.kind === "strict") {
      backfillIds.push(row.id);
      continue;
    }

    const overlap = picked.overlap ?? 0;
    if (overlap >= 2) {
      backfillIds.push(row.id);
      continue;
    }

    // overlap==1: only backfill when it met the same acceptance thresholds.
    if (overlap === 1 && picked.score - 110 >= 15) {
      backfillIds.push(row.id);
    }
  }

  if (baseNeedsSeriesKey || backfillIds.length) {
    await prisma.$transaction(async (tx) => {
      if (baseNeedsSeriesKey) {
        await tx.expense.updateMany({ where: { id: base.id, seriesKey: null }, data: { seriesKey } });
      }

      if (backfillIds.length) {
        await tx.expense.updateMany({ where: { id: { in: backfillIds }, seriesKey: null }, data: { seriesKey } });
      }
    });
  }

  const current = { month: base.month, year: base.year };

  const hasAnyBeforeCurrent = matches.some((m) => compareMonthYear({ month: m.month, year: m.year }, current) < 0);

  const currentYearMatches = matches.filter((m) => m.year === base.year);
  const start = (() => {
    if (!hasAnyBeforeCurrent) return current;
    if (currentYearMatches.length) {
      const minMonth = Math.min(...currentYearMatches.map((m) => m.month));
      return { month: minMonth, year: base.year };
    }

    const sorted = [...matches].sort((a, b) => compareMonthYear(a, b));
    const first = sorted[0];
    return first ? { month: first.month, year: first.year } : current;
  })();

  const monthsWindow = Array.from({ length: months }, (_, i) => addMonths(start.month, start.year, i));

  const byKey = new Map<string, (typeof matches)[number]>();
  for (const m of matches) {
    byKey.set(`${m.year}-${String(m.month).padStart(2, "0")}`, m);
  }

  const points = monthsWindow.map((mw) => {
    const key = `${mw.year}-${String(mw.month).padStart(2, "0")}`;
    const match = byKey.get(key) ?? null;

    const afterCurrent = compareMonthYear(mw, current) > 0;
    const beforeCurrent = compareMonthYear(mw, current) < 0;

    const isPastDue = (dueDate: Date | null | undefined): boolean => {
      if (dueDate instanceof Date && !Number.isNaN(dueDate.getTime())) {
        // Grace period: treat as upcoming until 5 days after due date.
        const graceMs = 5 * 24 * 60 * 60 * 1000;
        return Date.now() > dueDate.getTime() + graceMs;
      }
      // If no due date is set, treat prior months as missed and current/future as upcoming.
      return beforeCurrent;
    };

    if (!match) {
      const status: ExpenseFrequencyPointStatus = beforeCurrent ? "missed" : "upcoming";
      return {
        key,
        month: mw.month,
        year: mw.year,
        label: monthLabel(mw.month),
        present: false,
        ratio: 0,
        status,
      };
    }

    const amount = Number(match.amount?.toString?.() ?? match.amount ?? 0);
    const paidAmount = Number(match.paidAmount?.toString?.() ?? match.paidAmount ?? 0);
    const ratio = toRatio(amount, paidAmount, Boolean(match.paid));

    const status: ExpenseFrequencyPointStatus = ratio >= 0.999
      ? "paid"
      : ratio > 0
        ? "partial"
        : afterCurrent
          ? "upcoming"
          : isPastDue(match.dueDate)
            ? "missed"
            : "upcoming";

    return {
      key,
      month: match.month,
      year: match.year,
      label: monthLabel(match.month),
      present: true,
      ratio,
      status,
    };
  });

  const matchIds = matches.map((m) => m.id).filter(Boolean);
  const debts = matchIds.length
    ? await prisma.debt.findMany({
        where: {
          budgetPlanId: base.budgetPlanId,
          OR: [
            { sourceExpenseId: { in: matchIds } },
            // Backward-compat fallback when sourceExpenseId wasn't captured.
            { sourceExpenseName: { equals: base.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, paid: true, currentBalance: true },
      })
    : [];

  const activeDebts = debts.filter((d) => !d.paid && toNumber(d.currentBalance) > 0.005);
  const activeDebtCount = activeDebts.length;
  const activeDebtBalance = activeDebts.reduce((sum, d) => sum + toNumber(d.currentBalance), 0);
  const debtMeta = {
    hasDebt: debts.length > 0,
    cleared: debts.length > 0 ? activeDebtCount === 0 : true,
    activeCount: activeDebtCount,
    totalCount: debts.length,
    activeBalance: debts.length > 0 ? activeDebtBalance : 0,
  };

  return NextResponse.json({
    seriesKey,
    subtitle: hasAnyBeforeCurrent ? `From ${monthLabel(start.month)}` : "Next 6 months",
    points,
    debt: debtMeta,
  });
}
